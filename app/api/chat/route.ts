import {
  createAgentUIStreamResponse,
  generateText,
  UIMessage,
} from "ai";
import { gateway } from "@ai-sdk/gateway";
import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { createModel, createOrchestratorAgent } from "@/lib/agents";
import { createTrace, addTraceEvent } from "@/lib/trace-store";

export const maxDuration = 60;

const MEMORY_DIR = path.join(process.cwd(), "memory");

// ---------------------------------------------------------------------------
// Memory helpers
// ---------------------------------------------------------------------------

async function readMemory() {
  const [soul, vibes] = await Promise.all([
    fs.readFile(path.join(MEMORY_DIR, "soul.md"), "utf-8"),
    fs.readFile(path.join(MEMORY_DIR, "vibes.md"), "utf-8"),
  ]);
  return { soul, vibes };
}

async function updateMemory(modelId: string, conversation: string) {
  const { soul, vibes } = await readMemory();

  const { text } = await generateText({
    model: gateway(modelId as Parameters<typeof gateway>[0]),
    prompt: `You have two persistent memory files. Based on this conversation, rewrite them if anything is worth updating. Return ONLY valid JSON with keys "soul" and "vibes" — each value is the full new file content as a string. If nothing needs updating, return the originals unchanged.

Current soul.md:
${soul}

Current vibes.md:
${vibes}

Recent conversation:
${conversation}

Return JSON only, no markdown, no explanation.`,
  });

  try {
    const updates = JSON.parse(text.trim());
    if (updates.soul && updates.vibes) {
      await Promise.all([
        fs.writeFile(path.join(MEMORY_DIR, "soul.md"), updates.soul, "utf-8"),
        fs.writeFile(
          path.join(MEMORY_DIR, "vibes.md"),
          updates.vibes,
          "utf-8"
        ),
      ]);
    }
  } catch {
    // malformed JSON — skip silently
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const {
    messages,
    model: modelId,
  }: {
    messages: UIMessage[];
    model: string;
  } = await req.json();

  const { soul, vibes } = await readMemory();

  const model = createModel(modelId);

  const systemPrompt = `You are a helpful assistant with persistent memory and a research tool.

--- soul.md ---
${soul}

--- vibes.md ---
${vibes}
---

These files live on the human's computer and are updated automatically after each conversation.

You have a "research" tool. Use it whenever the question requires current or real-time information — news, prices, recent events, anything that may have changed since your training. For general knowledge, math, or coding you already know, answer directly.

When using the research tool, provide a clear, specific task description so the research agent can work effectively.`;

  const isAnthropic = modelId.startsWith("anthropic/");

  const agent = createOrchestratorAgent(model, systemPrompt, {
    ...(isAnthropic && {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 15000 },
      },
    }),
    gateway: {
      byok: {
        anthropic: [{ apiKey: process.env.ANTHROPIC_API_KEY }],
      },
    },
  });

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

    onFinish({ responseMessage, finishReason }) {
      // Extract final text from response for memory update
      const finalText = responseMessage.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");

      addTraceEvent(traceId, {
        kind: "agent-finish",
        timestamp: Date.now(),
        totalSteps: 0, // not available in this callback
        totalInputTokens: 0,
        totalOutputTokens: 0,
      });

      // Update memory (fire and forget)
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      const lastText = lastUserMessage?.parts?.find(
        (p) => p.type === "text"
      ) as { text: string } | undefined;
      const conversation = `Human: ${lastText?.text ?? ""}\nAssistant: ${finalText}`;
      updateMemory(modelId, conversation).catch(() => {});
    },

    sendSources: true,
    sendReasoning: true,
  });
}
