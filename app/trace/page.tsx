"use client";

import { useCallback, useEffect, useState } from "react";
import type { Trace, TraceEvent } from "@/lib/trace-store";

function EventRow({ event }: { event: TraceEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString();

  switch (event.kind) {
    case "agent-start":
      return (
        <div className="flex items-baseline gap-3 text-sm">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {time}
          </span>
          <span className="font-medium text-blue-500">Agent started</span>
          <span className="text-muted-foreground">model: {event.model}</span>
        </div>
      );

    case "step-start":
      return (
        <div className="flex items-baseline gap-3 text-sm">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {time}
          </span>
          <span className="font-medium">Step {event.stepNumber}</span>
        </div>
      );

    case "tool-call-start":
      return (
        <div className="ml-6 flex flex-col gap-1 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {time}
            </span>
            <span className="font-medium text-amber-500">
              {event.toolName}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {event.toolCallId}
            </span>
          </div>
          <pre className="ml-[4.5rem] max-h-40 overflow-auto rounded bg-muted/50 px-2 py-1 font-mono text-xs">
            {JSON.stringify(event.input, null, 2)}
          </pre>
        </div>
      );

    case "tool-call-finish":
      return (
        <div className="ml-6 flex flex-col gap-1 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {time}
            </span>
            <span
              className={`font-medium ${event.success ? "text-green-500" : "text-red-500"}`}
            >
              {event.toolName} — {event.success ? "success" : "error"}
            </span>
            <span className="text-muted-foreground">
              {event.durationMs}ms
            </span>
          </div>
          {event.output != null && (
            <pre className="ml-[4.5rem] max-h-40 overflow-auto rounded bg-muted/50 px-2 py-1 font-mono text-xs">
              {String(
                typeof event.output === "string"
                  ? event.output
                  : JSON.stringify(event.output, null, 2)
              )}
            </pre>
          )}
          {event.error && (
            <pre className="ml-[4.5rem] rounded bg-red-500/10 px-2 py-1 font-mono text-xs text-red-500">
              {event.error}
            </pre>
          )}
        </div>
      );

    case "step-finish":
      return (
        <div className="flex items-baseline gap-3 text-sm">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {time}
          </span>
          <span className="text-muted-foreground">
            Step {event.stepNumber} finished
          </span>
          <span className="font-mono text-xs">
            reason: {event.finishReason}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {event.inputTokens}in / {event.outputTokens}out
          </span>
          {event.toolCalls.length > 0 && (
            <span className="font-mono text-xs text-amber-500">
              [{event.toolCalls.join(", ")}]
            </span>
          )}
        </div>
      );

    case "agent-finish":
      return (
        <div className="flex items-baseline gap-3 text-sm">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {time}
          </span>
          <span className="font-medium text-green-500">Agent finished</span>
          <span className="text-muted-foreground">
            {event.totalSteps} steps
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {event.totalInputTokens}in / {event.totalOutputTokens}out
          </span>
        </div>
      );

    default:
      return null;
  }
}

function TraceDetail({ trace }: { trace: Trace }) {
  const createdAt = new Date(trace.createdAt).toLocaleString();

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-4">
        <h2 className="text-lg font-semibold">Trace {trace.id}</h2>
        <span className="text-sm text-muted-foreground">{createdAt}</span>
        <span className="font-mono text-sm text-muted-foreground">
          {trace.model}
        </span>
      </div>
      <div className="space-y-2">
        {trace.events.map((event, i) => (
          <EventRow event={event} key={i} />
        ))}
      </div>
    </div>
  );
}

export default function TracePage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);

  // Load trace list
  useEffect(() => {
    fetch("/api/traces")
      .then((r) => r.json())
      .then((data) => {
        setTraces(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load individual trace when selected
  useEffect(() => {
    if (!selectedId) {
      setSelectedTrace(null);
      return;
    }
    fetch(`/api/traces?id=${selectedId}`)
      .then((r) => r.json())
      .then(setSelectedTrace)
      .catch(() => setSelectedTrace(null));
  }, [selectedId]);

  // Check URL params for trace ID on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) setSelectedId(id);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, "", `?id=${id}`);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    window.history.replaceState(null, "", "/trace");
  }, []);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        Loading traces...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Agent Traces</h1>

      {selectedTrace ? (
        <div>
          <button
            className="mb-4 text-sm text-blue-500 hover:underline"
            onClick={handleBack}
            type="button"
          >
            &larr; Back to list
          </button>
          <TraceDetail trace={selectedTrace} />
        </div>
      ) : (
        <div className="space-y-2">
          {traces.length === 0 && (
            <p className="text-muted-foreground">
              No traces yet. Send a message in the chat to generate one.
            </p>
          )}
          {traces.map((trace) => (
            <button
              className="flex w-full items-baseline gap-4 rounded-md border px-4 py-3 text-left hover:bg-muted/50"
              key={trace.id}
              onClick={() => handleSelect(trace.id)}
              type="button"
            >
              <span className="font-mono text-sm">{trace.id}</span>
              <span className="text-sm text-muted-foreground">
                {trace.model}
              </span>
              <span className="text-sm text-muted-foreground">
                {trace.events.length} events
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(trace.createdAt).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
