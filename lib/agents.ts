import {
  ToolLoopAgent,
  tool,
  jsonSchema,
  generateText,
  readUIMessageStream,
  stepCountIs,
  wrapLanguageModel,
  InferAgentUIMessage,
  type LanguageModel,
  type LanguageModelMiddleware,
} from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import { gateway } from "@ai-sdk/gateway";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { z } from "zod";
import { readCronConfig, writeCronConfig, type CronConfig, type CronJob } from "./cron-config";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { browserTool } from "./browser-tool";
import { promisify } from "util";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Middleware that strips `additionalProperties` from tool schemas (some
 *  providers choke on it). */
const schemaFixMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformParams: async ({ params }: any) => ({
    ...params,
    tools: params.tools?.map((t: any) => {
      if (t.type !== "function") return t;
      const { additionalProperties: _, ...schema } = t.inputSchema as Record<
        string,
        unknown
      >;
      return { ...t, inputSchema: { type: "object", ...schema } };
    }),
  }),
};

/** Wrap a gateway model id with schema-fix + devtools middleware. */
export function createModel(modelId: string): LanguageModel {
  return wrapLanguageModel({
    model: wrapLanguageModel({
      model: gateway(modelId as Parameters<typeof gateway>[0]),
      middleware: schemaFixMiddleware,
    }),
    middleware: devToolsMiddleware(),
  });
}

// ---------------------------------------------------------------------------
// Artifact tool (surfaces generated content in the UI side panel)
// ---------------------------------------------------------------------------

export const artifactTool = tool({
  description: `Generate an artifact — a self-contained piece of content shown in a dedicated side panel. Use this when producing:
- Code in any programming language
- Markdown documents, READMEs, reports, essays
- HTML pages or interactive HTML snippets
- JSX/React components

Put the raw content directly in the "content" field. Do NOT wrap it in markdown code fences.`,
  inputSchema: z.object({
    type: z.enum(["code", "markdown", "html", "jsx"]).describe("Content type"),
    title: z.string().describe("Short descriptive title for the artifact"),
    content: z.string().describe("The full artifact content — no markdown fences"),
    language: z.string().optional().describe("For code artifacts: the programming language (e.g. 'typescript', 'python', 'rust')"),
  }),
  execute: async (input) => input,
});

// ---------------------------------------------------------------------------
// Web search tool (used by the research subagent)
// ---------------------------------------------------------------------------

const webSearchTool = tool({
  description:
    "Search the web for current, real-time information. Use this for up-to-date news, live data, or recent events.",
  inputSchema: z.object({
    query: z.string().describe("The search query to look up"),
  }),
  execute: async ({ query }) => {
    if (!query.trim()) return "No search query provided.";
    try {
      const { text } = await generateText({
        model: gateway("perplexity/sonar"),
        prompt: query,
      });
      return text;
    } catch (err) {
      return `Search failed: ${err instanceof Error ? err.message : String(err)}. Answer from your own knowledge.`;
    }
  },
});

// ---------------------------------------------------------------------------
// Research subagent
// ---------------------------------------------------------------------------

export function createResearchSubagent(model: LanguageModel) {
  return new ToolLoopAgent({
    id: "research-subagent",
    model,
    instructions: `You are a research agent. Complete the research task autonomously.

Use your web_search tool to find current, accurate information. You may search
multiple times to cross-reference or drill deeper.

IMPORTANT: When you have finished, write a clear, comprehensive summary of your
findings as your final response. This summary will be returned to the main
agent, so include all relevant information — facts, dates, sources, and key
details. Do not just say "Done".`,
    tools: { web_search: webSearchTool },
    stopWhen: stepCountIs(8),
  });
}

// ---------------------------------------------------------------------------
// Research tool (wraps the subagent for the orchestrator)
// ---------------------------------------------------------------------------

export function createResearchTool(model: LanguageModel) {
  const subagent = createResearchSubagent(model);

  return tool({
    description:
      "Research a topic in depth using web search. Use this for any question requiring current information, news, live data, or multi-step fact-finding. Returns a detailed summary.",
    inputSchema: z.object({
      task: z
        .string()
        .describe("The research task or question to investigate"),
    }),
    execute: async function* ({ task }, { abortSignal }) {
      const result = await subagent.stream({
        prompt: task,
        abortSignal,
      });

      for await (const message of readUIMessageStream({
        stream: result.toUIMessageStream(),
      })) {
        yield message;
      }
    },
    toModelOutput: ({ output: message }: { output: unknown }) => {
      // Give the parent model only the final text summary — not the full
      // subagent trace. This keeps the orchestrator's context compact.
      const msg = message as { parts?: Array<{ type: string; text?: string }> } | undefined;
      const lastTextPart = msg?.parts?.findLast((p) => p.type === "text");
      return {
        type: "text" as const,
        value: lastTextPart?.text ?? "Research completed — no summary produced.",
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Cron management tool (lets the agent create/update/delete cron jobs)
// ---------------------------------------------------------------------------

export const cronManageTool = tool({
  description: `Manage scheduled cron jobs and the heartbeat. Actions:
- "list": Show all cron jobs and heartbeat config
- "set_heartbeat": Enable/disable heartbeat or change its interval
- "add_job": Create a new scheduled job
- "update_job": Update an existing job (enable/disable, change schedule, etc.)
- "remove_job": Delete a scheduled job`,
  inputSchema: z.object({
    action: z.enum(["list", "set_heartbeat", "add_job", "update_job", "remove_job"]),
    // For set_heartbeat
    heartbeatEnabled: z.boolean().optional().describe("Enable or disable the heartbeat"),
    heartbeatIntervalMinutes: z.number().optional().describe("Heartbeat interval in minutes"),
    // For add_job / update_job
    jobId: z.string().optional().describe("Job ID (required for update/remove)"),
    jobName: z.string().optional().describe("Human-readable job name"),
    jobDescription: z.string().optional().describe("What this job does"),
    schedule: z.string().optional().describe("Cron expression, e.g. '0 9 * * 1' for Monday 9am"),
    enabled: z.boolean().optional().describe("Whether the job is enabled"),
    payload: z.record(z.string(), z.unknown()).optional().describe("Arbitrary config data for the job handler"),
  }),
  execute: async (input) => {
    const config = await readCronConfig();

    switch (input.action) {
      case "list": {
        return {
          heartbeatEnabled: config.heartbeatEnabled,
          heartbeatIntervalMinutes: config.heartbeatIntervalMinutes,
          jobs: config.jobs,
        };
      }

      case "set_heartbeat": {
        if (input.heartbeatEnabled !== undefined) {
          config.heartbeatEnabled = input.heartbeatEnabled;
        }
        if (input.heartbeatIntervalMinutes !== undefined) {
          config.heartbeatIntervalMinutes = input.heartbeatIntervalMinutes;
        }
        await writeCronConfig(config);
        return {
          message: "Heartbeat updated",
          heartbeatEnabled: config.heartbeatEnabled,
          heartbeatIntervalMinutes: config.heartbeatIntervalMinutes,
        };
      }

      case "add_job": {
        if (!input.jobId || !input.jobName || !input.schedule) {
          return { error: "jobId, jobName, and schedule are required" };
        }
        const newJob: CronJob = {
          id: input.jobId,
          name: input.jobName,
          description: input.jobDescription ?? "",
          schedule: input.schedule,
          enabled: input.enabled ?? true,
          payload: input.payload,
        };
        config.jobs.push(newJob);
        await writeCronConfig(config);
        return { message: `Job "${input.jobName}" added`, job: newJob };
      }

      case "update_job": {
        const job = config.jobs.find((j) => j.id === input.jobId);
        if (!job) return { error: `Job "${input.jobId}" not found` };
        if (input.jobName) job.name = input.jobName;
        if (input.jobDescription) job.description = input.jobDescription;
        if (input.schedule) job.schedule = input.schedule;
        if (input.enabled !== undefined) job.enabled = input.enabled;
        if (input.payload) job.payload = input.payload;
        await writeCronConfig(config);
        return { message: `Job "${job.name}" updated`, job };
      }

      case "remove_job": {
        const idx = config.jobs.findIndex((j) => j.id === input.jobId);
        if (idx === -1) return { error: `Job "${input.jobId}" not found` };
        const removed = config.jobs.splice(idx, 1)[0];
        await writeCronConfig(config);
        return { message: `Job "${removed.name}" removed` };
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Skills — discovery and load tool
// ---------------------------------------------------------------------------

export interface SkillMetadata {
  name: string;
  description: string;
  content: string;
  path: string;
}

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) throw new Error("No frontmatter");
  const fm = match[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
  if (!name || !description) throw new Error("Missing name or description in frontmatter");
  return { name, description };
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? content.slice(match[0].length).trim() : content.trim();
}

export async function discoverSkills(directories: string[]): Promise<SkillMetadata[]> {
  const skills: SkillMetadata[] = [];
  const seenNames = new Set<string>();

  for (const dir of directories) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(dir, entry.name);
      const skillFile = path.join(skillDir, "SKILL.md");
      try {
        const content = await fs.readFile(skillFile, "utf-8");
        const meta = parseFrontmatter(content);
        if (seenNames.has(meta.name)) continue;
        seenNames.add(meta.name);
        skills.push({ name: meta.name, description: meta.description, content: stripFrontmatter(content), path: skillDir });
      } catch {
        continue;
      }
    }
  }
  return skills;
}

const SKILLS_DIR = path.join(process.cwd(), ".agents/skills");

export const skillManageTool = tool({
  description: `Manage your own skills — reusable instruction sets you can load later. Actions:
- "list": Show all installed skills
- "add": Create a new skill with a name, description, and markdown instructions
- "update": Edit an existing skill's name, description, or instructions
- "remove": Delete a skill`,
  inputSchema: z.object({
    action: z.enum(["list", "add", "update", "remove"]),
    name: z.string().optional().describe("Skill name (kebab-case, e.g. 'code-runner')"),
    description: z.string().optional().describe("One-line description of what the skill does"),
    content: z.string().optional().describe("Full markdown instructions for the skill"),
    originalName: z.string().optional().describe("Current name of the skill to update (if renaming)"),
  }),
  execute: async (input) => {
    switch (input.action) {
      case "list": {
        const skills = await discoverSkills([SKILLS_DIR]);
        return { skills: skills.map((s) => ({ name: s.name, description: s.description })) };
      }

      case "add": {
        if (!input.name || !input.description) {
          return { error: "name and description are required" };
        }
        const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const skillDir = path.join(SKILLS_DIR, slug);
        await fs.mkdir(skillDir, { recursive: true });
        const md = `---\nname: ${input.name}\ndescription: ${input.description}\n---\n\n${input.content ?? ""}\n`;
        await fs.writeFile(path.join(skillDir, "SKILL.md"), md, "utf-8");
        return { message: `Skill "${input.name}" created`, slug };
      }

      case "update": {
        const lookupName = input.originalName ?? input.name;
        if (!lookupName) return { error: "name or originalName is required" };
        const oldSlug = lookupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const oldFile = path.join(SKILLS_DIR, oldSlug, "SKILL.md");
        let existing: string;
        try {
          existing = await fs.readFile(oldFile, "utf-8");
        } catch {
          return { error: `Skill "${lookupName}" not found` };
        }
        const meta = parseFrontmatter(existing);
        const oldContent = stripFrontmatter(existing);
        const newName = input.name ?? meta.name;
        const newDesc = input.description ?? meta.description;
        const newContent = input.content ?? oldContent;
        const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        if (newSlug !== oldSlug) {
          await fs.rename(path.join(SKILLS_DIR, oldSlug), path.join(SKILLS_DIR, newSlug));
        }
        const md = `---\nname: ${newName}\ndescription: ${newDesc}\n---\n\n${newContent}\n`;
        await fs.writeFile(path.join(SKILLS_DIR, newSlug, "SKILL.md"), md, "utf-8");
        return { message: `Skill "${newName}" updated`, slug: newSlug };
      }

      case "remove": {
        if (!input.name) return { error: "name is required" };
        const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        try {
          await fs.rm(path.join(SKILLS_DIR, slug), { recursive: true });
        } catch {
          return { error: `Skill "${input.name}" not found` };
        }
        return { message: `Skill "${input.name}" removed` };
      }
    }
  },
});

function buildSkillsPrompt(skills: SkillMetadata[]): string {
  if (skills.length === 0) return "";
  const list = skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n");
  return `\n\n## Available Skills\n\nUse the \`loadSkill\` tool when the user's request matches one of these:\n${list}`;
}

function createLoadSkillTool(skills: SkillMetadata[]) {
  return tool({
    description: "Load a skill to get specialized instructions for a task. Call this when the user's request matches a skill's description.",
    inputSchema: z.object({
      name: z.string().describe("The skill name to load"),
    }),
    execute: async ({ name }) => {
      const skill = skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (!skill) {
        const available = skills.map((s) => s.name).join(", ");
        return { error: `Skill '${name}' not found. Available: ${available || "none"}` };
      }
      const content = await fs.readFile(path.join(skill.path, "SKILL.md"), "utf-8");
      return { skillDirectory: skill.path, content: stripFrontmatter(content) };
    },
  });
}

// ---------------------------------------------------------------------------
// Bash tool — execute shell commands
// ---------------------------------------------------------------------------

const stripAnsi = (str: string) => str.replace(/\x1B\[[0-9;]*[mGKHF]/g, "");

const bashTool = tool({
  description: "Execute a bash command and return stdout/stderr. Use for running scripts, code, file operations, or any shell command.",
  inputSchema: z.object({
    command: z.string().describe("The bash command to execute"),
  }),
  execute: async ({ command }) => {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 30_000,
      });
      return {
        stdout: stripAnsi(stdout.trim()),
        stderr: stripAnsi(stderr.trim()),
        exitCode: 0,
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: stripAnsi(e.stdout?.trim() ?? ""),
        stderr: stripAnsi(e.stderr?.trim() ?? String(err)),
        exitCode: e.code ?? 1,
      };
    }
  },
});

// ---------------------------------------------------------------------------
// ReadFile tool — read files relative to cwd
// ---------------------------------------------------------------------------

const readFileTool = tool({
  description: "Read a file from the filesystem and return its contents. Paths are resolved relative to the project root.",
  inputSchema: z.object({
    path: z.string().describe("Path to the file (absolute or relative to project root)"),
  }),
  execute: async ({ path: filePath }) => {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    try {
      const content = await fs.readFile(resolved, "utf-8");
      return { content };
    } catch (err) {
      return { error: String(err) };
    }
  },
});

// ---------------------------------------------------------------------------
// Orchestrator agent
// ---------------------------------------------------------------------------

export function createOrchestratorAgent(
  model: LanguageModel,
  systemPrompt: string,
  skills: SkillMetadata[],
  providerOptions?: ProviderOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraTools?: Record<string, any>
) {
  const research = createResearchTool(model);
  const loadSkill = createLoadSkillTool(skills);
  const instructions = systemPrompt + buildSkillsPrompt(skills);

  return new ToolLoopAgent({
    id: "orchestrator",
    model,
    instructions,
    tools: { research, artifact: artifactTool, cron_manage: cronManageTool, skill_manage: skillManageTool, browser: browserTool, bash: bashTool, readFile: readFileTool, loadSkill, ...extraTools },
    stopWhen: stepCountIs(20),
    providerOptions,
  });
}

// ---------------------------------------------------------------------------
// Type exports for the UI
// ---------------------------------------------------------------------------

// Create a representative agent instance just for type inference.
// It's never called — only used at the type level.
const _typingAgent = new ToolLoopAgent({
  model: undefined as unknown as LanguageModel,
  tools: {
    research: createResearchTool(undefined as unknown as LanguageModel),
    artifact: artifactTool,
    cron_manage: cronManageTool,
    skill_manage: skillManageTool,
    browser: browserTool,
    bash: bashTool,
    readFile: readFileTool,
    loadSkill: createLoadSkillTool([]),
  },
});

export type OrchestratorMessage = InferAgentUIMessage<typeof _typingAgent>;
