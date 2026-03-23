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
// Orchestrator agent
// ---------------------------------------------------------------------------

export function createOrchestratorAgent(
  model: LanguageModel,
  systemPrompt: string,
  providerOptions?: ProviderOptions
) {
  const research = createResearchTool(model);

  return new ToolLoopAgent({
    id: "orchestrator",
    model,
    instructions: systemPrompt,
    tools: { research },
    stopWhen: stepCountIs(10),
    providerOptions,
    prepareStep: async ({ stepNumber, steps, messages }) => {
      // --- Step 0: bias toward research if the query looks research-heavy ---
      if (stepNumber === 0) {
        const last = messages[messages.length - 1];
        const text =
          typeof last?.content === "string"
            ? last.content
            : Array.isArray(last?.content)
              ? last.content
                  .filter((p: { type: string }) => p.type === "text")
                  .map((p: { type: string; text?: string }) => p.text ?? "")
                  .join(" ")
              : "";

        const researchSignals =
          /\b(latest|recent|current|news|today|update|what('?s| is) happening|search|find out|look up|research)\b/i;

        if (researchSignals.test(text)) {
          return {
            toolChoice: { type: "tool" as const, toolName: "research" },
          };
        }
      }

      // --- Context compaction: trim if messages get large ---
      if (messages.length > 20) {
        return {
          messages: [messages[0], ...messages.slice(-10)],
        };
      }

      return {};
    },
  });
}

// ---------------------------------------------------------------------------
// Type exports for the UI
// ---------------------------------------------------------------------------

// Create a representative agent instance just for type inference.
// It's never called — only used at the type level.
const _typingAgent = new ToolLoopAgent({
  model: undefined as unknown as LanguageModel,
  tools: { research: createResearchTool(undefined as unknown as LanguageModel) },
});

export type OrchestratorMessage = InferAgentUIMessage<typeof _typingAgent>;
