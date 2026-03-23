import { generateText, stepCountIs } from "ai";
import fs from "fs/promises";
import path from "path";
import {
  createModel,
  discoverSkills,
  artifactTool,
  cronManageTool,
  memoryTool,
  bashTool,
  readFileTool,
  createLoadSkillTool,
  webSearchTool,
  createResearchTool,
} from "./agents";
import { createGoogleTools } from "./google-tools";
import { loadGoogleTokens, saveGoogleTokens } from "./google-token-store";
import { addNotification } from "./notification-store";

const MEMORY_DIR = path.join(process.cwd(), "memory");
const BACKGROUND_MODEL = process.env.BACKGROUND_MODEL ?? "openai/gpt-5.4-mini";

async function readMemory() {
  try {
    const [soul, vibes] = await Promise.all([
      fs.readFile(path.join(MEMORY_DIR, "soul.md"), "utf-8"),
      fs.readFile(path.join(MEMORY_DIR, "vibes.md"), "utf-8"),
    ]);
    return { soul, vibes };
  } catch {
    return { soul: "", vibes: "" };
  }
}

async function getFreshAccessToken(stored: Awaited<ReturnType<typeof loadGoogleTokens>>) {
  if (!stored) return null;

  // Still valid
  if (Date.now() < stored.expiresAt * 1000 - 60_000) {
    return stored.accessToken;
  }

  // Refresh
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const newTokens = {
      ...stored,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    };
    await saveGoogleTokens(newTokens);
    return newTokens.accessToken;
  } catch {
    return null;
  }
}

export async function runBackgroundTask(
  taskPrompt: string,
  source: "heartbeat" | "cron",
  jobName: string
): Promise<void> {
  try {
    const [{ soul, vibes }, skills, storedTokens] = await Promise.all([
      readMemory(),
      discoverSkills([path.join(process.cwd(), ".agents/skills")]),
      loadGoogleTokens(),
    ]);

    const accessToken = await getFreshAccessToken(storedTokens);
    const googleTools = accessToken ? createGoogleTools(accessToken) : {};
    const loadSkill = createLoadSkillTool(skills);
    const model = createModel(BACKGROUND_MODEL);
    const research = createResearchTool(model);

    const hasGoogle = Object.keys(googleTools).length > 0;

    const systemPrompt = `You are a helpful assistant running a scheduled background task. There is no user present.

--- soul.md ---
${soul}

--- vibes.md ---
${vibes}
---

You have access to: research (web search), bash, readFile, memory, cron_manage, and loadSkill tools.${hasGoogle ? `
You also have full access to the user's Google account: gmail_list_emails, gmail_get_email, gmail_send_email, calendar_list_events, calendar_create_event, drive_list_files, drive_get_file, docs_get_document, slides_get_presentation.` : ""}

Complete the task autonomously. Write a clear, concise summary of what you did and found — this will be shown to the user as a notification.`;

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `[BACKGROUND TASK — ${source.toUpperCase()}]\n\nJob: ${jobName}\n\nTask: ${taskPrompt}`,
      tools: {
        research,
        artifact: artifactTool,
        cron_manage: cronManageTool,
        memory: memoryTool,
        bash: bashTool,
        readFile: readFileTool,
        loadSkill,
        web_search: webSearchTool,
        ...googleTools,
      },
      stopWhen: stepCountIs(20),
    });

    addNotification({
      timestamp: new Date().toISOString(),
      source,
      jobName,
      result: text || "(no output)",
    });
  } catch (err) {
    addNotification({
      timestamp: new Date().toISOString(),
      source,
      jobName,
      result: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
