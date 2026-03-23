// Simple in-memory trace store for development.
// In production you'd persist these to a database.

export type TraceEvent =
  | { kind: "agent-start"; timestamp: number; model: string }
  | { kind: "step-start"; timestamp: number; stepNumber: number }
  | {
      kind: "tool-call-start";
      timestamp: number;
      toolName: string;
      toolCallId: string;
      input: unknown;
    }
  | {
      kind: "tool-call-finish";
      timestamp: number;
      toolName: string;
      toolCallId: string;
      durationMs: number;
      success: boolean;
      output?: unknown;
      error?: string;
    }
  | {
      kind: "step-finish";
      timestamp: number;
      stepNumber: number;
      finishReason: string;
      inputTokens: number;
      outputTokens: number;
      toolCalls: string[];
    }
  | {
      kind: "agent-finish";
      timestamp: number;
      totalSteps: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    };

export interface Trace {
  id: string;
  model: string;
  createdAt: number;
  events: TraceEvent[];
}

const store = new Map<string, Trace>();
const MAX_TRACES = 50;

export function createTrace(id: string, model: string): Trace {
  const trace: Trace = {
    id,
    model,
    createdAt: Date.now(),
    events: [],
  };
  store.set(id, trace);

  // Evict oldest traces if we exceed the cap
  if (store.size > MAX_TRACES) {
    const oldest = [...store.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, store.size - MAX_TRACES);
    for (const [key] of oldest) store.delete(key);
  }

  return trace;
}

export function addTraceEvent(traceId: string, event: TraceEvent) {
  const trace = store.get(traceId);
  if (trace) trace.events.push(event);
}

export function getTrace(id: string): Trace | undefined {
  return store.get(id);
}

export function listTraces(): Trace[] {
  return [...store.values()].sort((a, b) => b.createdAt - a.createdAt);
}
