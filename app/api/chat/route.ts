import {
  createAgentUIStreamResponse,
  UIMessage,
} from "ai";
import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { createModel, createOrchestratorAgent, discoverSkills } from "@/lib/agents";
import { createTrace, addTraceEvent } from "@/lib/trace-store";
import { createGoogleTools } from "@/lib/google-tools";
import { auth } from "@/auth";

export const maxDuration = 60;

const MEMORY_DIR = path.join(process.cwd(), "memory");

async function readMemory() {
  const [soul, vibes] = await Promise.all([
    fs.readFile(path.join(MEMORY_DIR, "soul.md"), "utf-8"),
    fs.readFile(path.join(MEMORY_DIR, "vibes.md"), "utf-8"),
  ]);
  return { soul, vibes };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const {
    messages: rawMessages,
    model: modelId,
  }: {
    messages: UIMessage[];
    model: string;
  } = await req.json();

  // The SDK's SSRF validator blocks data: URLs and localhost in file parts.
  // Save images to disk and pass the path to the model as text so it can
  // read the file with its readFile tool if needed.
  const messages = await Promise.all(
    rawMessages.map(async (msg) => ({
      ...msg,
      parts: (
        await Promise.all(
          msg.parts.map(async (part) => {
            if (
              part.type === "file" &&
              "url" in part &&
              typeof part.url === "string" &&
              part.url.startsWith("data:")
            ) {
              const base64 = part.url.split(",")[1];
              if (!base64) return null;
              const id = nanoid(12);
              const ext = (part.mediaType as string)?.split("/")[1]?.replace(/\+.*/, "") ?? "bin";
              const tmpPath = path.join("/tmp", `upload-${id}.${ext}`);
              await fs.writeFile(tmpPath, Buffer.from(base64, "base64"));
              return {
                type: "text" as const,
                text: `[User attached an image: ${tmpPath} (${part.mediaType})]`,
              };
            }
            return part;
          })
        )
      ).filter(Boolean),
    }))
  ) as UIMessage[];

  const [{ soul, vibes }, skills, session] = await Promise.all([
    readMemory(),
    discoverSkills([path.join(process.cwd(), ".agents/skills")]),
    auth(),
  ]);

  const accessToken = (session as unknown as { accessToken?: string } | null)?.accessToken;
  const googleTools = accessToken ? createGoogleTools(accessToken) : undefined;

  const model = createModel(modelId);

  const systemPrompt = `You are a helpful assistant with persistent memory and tools.

--- soul.md ---
${soul}

--- vibes.md ---
${vibes}
---

You have a "memory" tool that lets you read and update soul.md and vibes.md at any time. Use it when you learn something meaningful about the user, their preferences, or your relationship. Don't update on every message — only when there's something worth persisting for future conversations.

You have a "research" tool. Use it whenever the question requires current or real-time information — news, prices, recent events, anything that may have changed since your training. For general knowledge, math, or coding you already know, answer directly.

When using the research tool, provide a clear, specific task description so the research agent can work effectively.${googleTools ? `

You have access to the user's Google account. Tools available: gmail_list_emails, gmail_get_email, gmail_send_email, calendar_list_events, calendar_create_event, drive_list_files, drive_get_file, docs_get_document, slides_get_presentation. Use these when the user asks about their email, calendar, files, or documents.` : ""}`;

  const isAnthropic = modelId.startsWith("anthropic/");

  const agent = createOrchestratorAgent(
    model,
    systemPrompt,
    skills,
    isAnthropic
      ? { anthropic: { thinking: { type: "enabled", budgetTokens: 15000 } } }
      : undefined,
    googleTools
  );

  // --- Trace collection ---
  const traceId = nanoid(10);
  createTrace(traceId, modelId);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,

    onStepFinish({ stepNumber, usage, finishReason, toolCalls }) {
      addTraceEvent(traceId, {
        kind: "step-finish",
        timestamp: Date.now(),
        stepNumber,
        finishReason: finishReason ?? "unknown",
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        toolCalls: toolCalls?.map((tc) => tc.toolName) ?? [],
      });
    },

    onFinish() {
      addTraceEvent(traceId, {
        kind: "agent-finish",
        timestamp: Date.now(),
        totalSteps: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      });
    },

    sendSources: true,
    sendReasoning: true,
  });
}
