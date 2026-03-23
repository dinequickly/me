"use client";

import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  CodeBlock,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ai-elements/code-block";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Sandbox,
  SandboxContent,
  SandboxHeader,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
} from "@/components/ai-elements/sandbox";
import {
  JSXPreview,
  JSXPreviewContent,
  JSXPreviewError,
} from "@/components/ai-elements/jsx-preview";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
import type { OrchestratorMessage } from "@/lib/agents";
import { Sidebar } from "@/components/sidebar";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { ToolUIPart } from "ai";
import type { BundledLanguage } from "shiki";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileTextIcon,
  GlobeIcon,
  Loader2Icon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

const models = [
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    providers: ["anthropic"],
  },
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    providers: ["anthropic"],
  },
  {
    chef: "Google",
    chefSlug: "google",
    id: "google/gemini-3-flash",
    name: "Gemini 3 Flash",
    providers: ["google"],
  },
  {
    chef: "Google",
    chefSlug: "google",
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite Preview",
    providers: ["google"],
  },
  {
    chef: "xAI",
    chefSlug: "xai",
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast",
    providers: ["xai"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "openai/gpt-5.4",
    name: "GPT-5.4",
    providers: ["openai"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "openai/gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    providers: ["openai"],
  },
];

const suggestions = [
  "What are the latest trends in AI?",
  "How does machine learning work?",
  "Explain quantum computing",
  "Best practices for React development",
  "Tell me about TypeScript benefits",
  "How to optimize database queries?",
];

const chefs = ["Anthropic", "Google", "xAI", "OpenAI"];

// ---------------------------------------------------------------------------
// Artifact types
// ---------------------------------------------------------------------------

interface ArtifactData {
  type: "code" | "markdown" | "html" | "jsx";
  title: string;
  content: string;
  language?: string;
}

// ---------------------------------------------------------------------------
// Wrap HTML artifacts to prevent navigation inside the iframe
// ---------------------------------------------------------------------------

function wrapArtifactHtml(html: string): string {
  const navScript = `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.href){e.preventDefault();e.stopPropagation();}},true);document.addEventListener('submit',function(e){e.preventDefault();},true);</script>`;
  // Inject before </head> if present, otherwise before </body>, otherwise prepend
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, navScript + '</head>');
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, navScript + '</body>');
  }
  return navScript + html;
}

// ---------------------------------------------------------------------------
// Artifact panel (side panel)
// ---------------------------------------------------------------------------

const ArtifactPanel = ({
  artifact,
  onClose,
}: {
  artifact: ArtifactData;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number>(0);

  const handleCopy = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
  }, [artifact.content]);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return (
    <Artifact className="h-full rounded-none border-0 border-l shadow-none">
      <ArtifactHeader>
        <div className="min-w-0 flex-1">
          <ArtifactTitle className="truncate">{artifact.title}</ArtifactTitle>
          <ArtifactDescription>
            {artifact.type}
            {artifact.language ? ` · ${artifact.language}` : ""}
          </ArtifactDescription>
        </div>
        <ArtifactActions>
          <ArtifactAction
            icon={copied ? CheckIcon : CopyIcon}
            label="Copy"
            onClick={handleCopy}
            tooltip="Copy"
          />
          <ArtifactClose onClick={onClose} />
        </ArtifactActions>
      </ArtifactHeader>
      <ArtifactContent className="p-0 overflow-auto">
        {artifact.type === "code" && (
          <CodeBlock
            className="rounded-none border-0"
            code={artifact.content}
            language={(artifact.language ?? "text") as BundledLanguage}
            showLineNumbers
          >
            <CodeBlockHeader>
              <CodeBlockTitle>
                <CodeBlockFilename>{artifact.language ?? "text"}</CodeBlockFilename>
              </CodeBlockTitle>
            </CodeBlockHeader>
          </CodeBlock>
        )}
        {artifact.type === "markdown" && (
          <div className="p-4 text-sm">
            <MessageResponse>{artifact.content}</MessageResponse>
          </div>
        )}
        {artifact.type === "html" && (
          <iframe
            className="size-full"
            sandbox="allow-scripts"
            srcDoc={wrapArtifactHtml(artifact.content)}
            title={artifact.title}
          />
        )}
        {artifact.type === "jsx" && (
          <JSXPreview className="p-4" jsx={artifact.content}>
            <JSXPreviewContent />
            <JSXPreviewError />
          </JSXPreview>
        )}
      </ArtifactContent>
    </Artifact>
  );
};

// ---------------------------------------------------------------------------
// Inline artifact card (shown in the message thread)
// ---------------------------------------------------------------------------

function ArtifactToolPart({
  part,
  onOpen,
}: {
  part: { type: string; state?: string; input?: unknown; toolCallId?: string };
  onOpen: () => void;
}) {
  const isStreaming =
    part.state === "input-streaming" || part.state === "input-available";
  const isComplete = part.state === "output-available";

  if (!isStreaming && !isComplete) return null;

  const input = isComplete ? (part.input as ArtifactData | undefined) : undefined;

  return (
    <button
      className={cn(
        "my-2 flex w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-left text-sm transition-colors",
        isComplete && "cursor-pointer hover:bg-muted/50"
      )}
      disabled={!isComplete}
      onClick={isComplete ? onOpen : undefined}
      type="button"
    >
      {isStreaming ? (
        <Loader2Icon className="size-3.5 shrink-0 animate-spin text-blue-500" />
      ) : (
        <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 truncate font-medium">
        {isStreaming ? "Generating artifact..." : (input?.title ?? "Artifact")}
      </span>
      {isComplete && input && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {input.type}
          {input.language ? ` · ${input.language}` : ""}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const AttachmentItem = ({
  attachment,
  onRemove,
}: {
  attachment: { id: string; mediaType: string; url: string; type: "file" };
  onRemove: (id: string) => void;
}) => {
  const handleRemove = useCallback(() => {
    onRemove(attachment.id);
  }, [onRemove, attachment.id]);

  return (
    <Attachment data={attachment} onRemove={handleRemove}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  );
};

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => {
      attachments.remove(id);
    },
    [attachments]
  );

  if (attachments.files.length === 0) return null;

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <AttachmentItem
          attachment={attachment as { id: string; mediaType: string; url: string; type: "file" }}
          key={attachment.id}
          onRemove={handleRemove}
        />
      ))}
    </Attachments>
  );
};

const SuggestionItem = ({
  suggestion,
  onClick,
}: {
  suggestion: string;
  onClick: (suggestion: string) => void;
}) => {
  const handleClick = useCallback(() => {
    onClick(suggestion);
  }, [onClick, suggestion]);

  return <Suggestion onClick={handleClick} suggestion={suggestion} />;
};

const ModelItem = ({
  m,
  isSelected,
  onSelect,
}: {
  m: (typeof models)[0];
  isSelected: boolean;
  onSelect: (id: string) => void;
}) => {
  const handleSelect = useCallback(() => {
    onSelect(m.id);
  }, [onSelect, m.id]);

  return (
    <ModelSelectorItem onSelect={handleSelect} value={m.id}>
      <ModelSelectorLogo provider={m.chefSlug} />
      <ModelSelectorName>{m.name}</ModelSelectorName>
      <ModelSelectorLogoGroup>
        {m.providers.map((provider) => (
          <ModelSelectorLogo key={provider} provider={provider} />
        ))}
      </ModelSelectorLogoGroup>
      {isSelected ? (
        <CheckIcon className="ml-auto size-4" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </ModelSelectorItem>
  );
};

// ---------------------------------------------------------------------------
// Bash / sandbox renderer
// ---------------------------------------------------------------------------

function SandboxToolPart({
  part,
}: {
  part: { type: string; state?: string; input?: unknown; output?: unknown };
}) {
  const state = (part.state ?? "input-streaming") as ToolUIPart["state"];
  const input = part.input as { command?: string } | undefined;
  const output = part.output as { stdout?: string; stderr?: string; exitCode?: number } | undefined;

  const command = input?.command ?? "";
  const stdout = output?.stdout ?? "";
  const stderr = output?.stderr ?? "";
  const outputText = [stdout, stderr].filter(Boolean).join("\n") || "(no output)";

  return (
    <Sandbox className="my-2">
      <SandboxHeader
        state={state}
        title={command.length > 70 ? `${command.slice(0, 67)}…` : command || "bash"}
      />
      <SandboxContent>
        <SandboxTabs defaultValue="command">
          <SandboxTabsBar>
            <SandboxTabsList>
              <SandboxTabsTrigger value="command">Command</SandboxTabsTrigger>
              <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
            </SandboxTabsList>
          </SandboxTabsBar>
          <SandboxTabContent value="command">
            <CodeBlock
              className="rounded-none border-0"
              code={command}
              language={"bash" as BundledLanguage}
            />
          </SandboxTabContent>
          <SandboxTabContent value="output">
            <CodeBlock
              className="rounded-none border-0"
              code={outputText}
              language={"text" as BundledLanguage}
            />
          </SandboxTabContent>
        </SandboxTabs>
      </SandboxContent>
    </Sandbox>
  );
}

// ---------------------------------------------------------------------------
// Browser tool renderer
// ---------------------------------------------------------------------------

function BrowserToolPart({
  part,
}: {
  part: { type: string; state?: string; input?: unknown; output?: unknown };
}) {
  const [expanded, setExpanded] = useState(false);
  const state = part.state ?? "input-streaming";
  const isRunning = state === "input-streaming" || state === "input-available";
  const isComplete = state === "output-available";

  const input = part.input as { action?: string; url?: string; selector?: string } | undefined;
  const output = part.output as { screenshot?: string; message?: string; title?: string; content?: string; error?: string } | undefined;

  const label = (() => {
    if (!input?.action) return "Browser";
    switch (input.action) {
      case "navigate": return `Navigate to ${input.url ?? "..."}`;
      case "screenshot": return "Screenshot";
      case "click": return `Click "${input.selector}"`;
      case "type": return `Type into "${input.selector}"`;
      case "scroll": return "Scroll";
      case "read": return "Read page content";
      case "evaluate": return "Run JavaScript";
      case "close": return "Close browser";
      default: return input.action;
    }
  })();

  return (
    <div className="my-2 rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        {isRunning ? (
          <Loader2Icon className="size-3.5 animate-spin text-blue-500" />
        ) : output?.error ? (
          <SearchIcon className="size-3.5 text-red-500" />
        ) : (
          <SearchIcon className="size-3.5 text-green-500" />
        )}
        <span className="font-medium truncate">{isRunning ? `${label}...` : label}</span>
        {isComplete && output?.title && (
          <span className="truncate text-muted-foreground text-xs ml-1">— {output.title}</span>
        )}
        <ChevronDownIcon className={`ml-auto size-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && isComplete && output && (
        <div className="border-t border-border/40 px-3 py-3 space-y-2">
          {output.error && <p className="text-sm text-red-500">{output.error}</p>}
          {output.message && <p className="text-xs text-muted-foreground">{output.message}</p>}
          {output.screenshot && (
            <img
              src={`data:image/png;base64,${output.screenshot}`}
              alt="Browser screenshot"
              className="w-full rounded-md border border-border/40"
            />
          )}
          {output.content && (
            <pre className="max-h-48 overflow-auto rounded-md bg-background/50 p-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {output.content.slice(0, 2000)}{output.content.length > 2000 ? "..." : ""}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Load skill renderer
// ---------------------------------------------------------------------------

function LoadSkillToolPart({
  part,
}: {
  part: { type: string; state?: string; input?: unknown };
}) {
  const isLoading =
    part.state === "input-streaming" || part.state === "input-available";
  const isComplete = part.state === "output-available";
  if (!isLoading && !isComplete) return null;

  const skillName = (part.input as { name?: string } | undefined)?.name ?? "";

  return (
    <div className="my-2 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
      {isLoading ? (
        <Loader2Icon className="size-3.5 shrink-0 animate-spin text-blue-500" />
      ) : (
        <BookOpenIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="text-muted-foreground">
        {isLoading ? `Loading skill: ${skillName}…` : `Loaded skill: ${skillName}`}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Research tool output renderer
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResearchToolPart({ part }: { part: any }) {
  const [expanded, setExpanded] = useState(false);

  if (!("state" in part)) return null;

  const isStreaming =
    part.state === "output-available" && part.preliminary === true;
  const isComplete =
    part.state === "output-available" && !part.preliminary;
  const isRunning =
    part.state === "input-available" || part.state === "input-streaming";
  const hasError = part.state === "output-error";

  const task =
    part.state !== "input-streaming" && part.input
      ? (part.input as { task?: string }).task
      : undefined;

  // The subagent streams a UIMessage as the tool output
  const output =
    part.state === "output-available" ? part.output : undefined;

  // Get nested parts from the subagent's UIMessage output
  const nestedParts: Array<{ type: string; [k: string]: unknown }> =
    (output as { parts?: Array<{ type: string }> })?.parts ?? [];
  const nestedTextParts = nestedParts.filter((p) => p.type === "text");
  const nestedToolParts = nestedParts.filter((p) =>
    p.type.startsWith("tool-")
  );

  return (
    <div className="my-3 rounded-lg border border-border/60 bg-muted/30">
      {/* Header */}
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        {isRunning || isStreaming ? (
          <Loader2Icon className="size-3.5 animate-spin text-blue-500" />
        ) : hasError ? (
          <SearchIcon className="size-3.5 text-red-500" />
        ) : (
          <SearchIcon className="size-3.5 text-green-500" />
        )}
        <span className="font-medium">
          {isRunning
            ? "Researching..."
            : isStreaming
              ? "Researching..."
              : hasError
                ? "Research failed"
                : "Research complete"}
        </span>
        {task && (
          <span className="truncate text-muted-foreground">— {task}</span>
        )}
        <ChevronDownIcon
          className={`ml-auto size-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded details: full subagent trace */}
      {expanded && (
        <div className="space-y-3 border-t border-border/40 px-3 py-3">
          {/* Subagent tool calls (web searches it made) */}
          {nestedToolParts.map(
            (
              nestedTool: {
                type: string;
                state?: string;
                toolCallId?: string;
                input?: unknown;
                output?: unknown;
              },
              i: number
            ) => (
              <div
                className="rounded-md border border-border/40 bg-background/50 px-3 py-2 text-xs"
                key={nestedTool.toolCallId ?? i}
              >
                <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  <SearchIcon className="size-3" />
                  {nestedTool.type.replace("tool-", "")}
                  {nestedTool.state === "output-available" && (
                    <span className="text-green-600">done</span>
                  )}
                  {nestedTool.state === "input-available" && (
                    <Loader2Icon className="size-3 animate-spin" />
                  )}
                </div>
                {nestedTool.input != null && (
                  <div className="mt-1 text-muted-foreground">
                    {"Query: "}
                    {String(
                      (nestedTool.input as { query?: string }).query ??
                        JSON.stringify(nestedTool.input)
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {/* Subagent text output */}
          {nestedTextParts.map(
            (tp: { type: string; text?: string }, i: number) =>
              tp.text ? (
                <div className="text-sm" key={i}>
                  <MessageResponse>{tp.text}</MessageResponse>
                </div>
              ) : null
          )}

          {hasError && "errorText" in part && (
            <div className="text-sm text-red-500">
              {String(part.errorText ?? "")}
            </div>
          )}
        </div>
      )}

      {/* Collapsed: show final text summary if complete */}
      {!expanded && isComplete && nestedTextParts.length > 0 && (
        <div className="border-t border-border/40 px-3 py-2">
          <div className="line-clamp-2 text-sm text-muted-foreground">
            {(
              nestedTextParts[nestedTextParts.length - 1] as {
                text?: string;
              }
            )?.text?.slice(0, 200)}
            ...
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live browser stream hook (also buffers frames for replay)
// ---------------------------------------------------------------------------

type RecordedFrame = { t: number; data: string };

function useBrowserStream() {
  const [frame, setFrame] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const framesRef = useRef<RecordedFrame[]>([]);
  const sessionStartRef = useRef<number>(0);
  const [recordedFrames, setRecordedFrames] = useState<RecordedFrame[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/browser/stream");

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "frame") {
          setFrame(msg.data);
          if (sessionStartRef.current > 0) {
            framesRef.current.push({
              t: Date.now() - sessionStartRef.current,
              data: msg.data,
            });
          }
        } else if (msg.type === "status") {
          if (msg.status === "open") {
            setBrowserOpen(true);
            framesRef.current = [];
            sessionStartRef.current = Date.now();
            setRecordedFrames([]);
          } else {
            setBrowserOpen(false);
            setFrame(null);
            // Freeze recorded frames for replay
            if (framesRef.current.length > 0) {
              setRecordedFrames([...framesRef.current]);
            }
          }
        }
      } catch {
        // ignore
      }
    };

    return () => es.close();
  }, []);

  return { frame, browserOpen, recordedFrames };
}

// ---------------------------------------------------------------------------
// Browser live preview panel with replay
// ---------------------------------------------------------------------------

function BrowserPanel({
  frame,
  browserOpen,
  recordedFrames,
  onClose,
}: {
  frame: string | null;
  browserOpen: boolean;
  recordedFrames: RecordedFrame[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [replayIdx, setReplayIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playTimerRef = useRef<number>(0);

  // Switch to live when browser opens
  useEffect(() => {
    if (browserOpen) setMode("live");
  }, [browserOpen]);

  // Auto-switch to replay when browser closes and we have frames
  useEffect(() => {
    if (!browserOpen && recordedFrames.length > 0 && mode === "live") {
      setMode("replay");
      setReplayIdx(0);
      setPlaying(false);
    }
  }, [browserOpen, recordedFrames.length, mode]);

  // Playback timer
  useEffect(() => {
    if (!playing || mode !== "replay" || recordedFrames.length === 0) return;

    const tick = () => {
      setReplayIdx((prev) => {
        const next = prev + 1;
        if (next >= recordedFrames.length) {
          setPlaying(false);
          return recordedFrames.length - 1;
        }
        // Schedule next frame based on actual time deltas
        const delay = recordedFrames[next].t - recordedFrames[prev].t;
        playTimerRef.current = window.setTimeout(tick, Math.min(delay, 200));
        return next;
      });
    };

    playTimerRef.current = window.setTimeout(tick, 50);
    return () => window.clearTimeout(playTimerRef.current);
  }, [playing, mode, recordedFrames]);

  const replayFrame =
    mode === "replay" && recordedFrames.length > 0
      ? recordedFrames[replayIdx]?.data
      : null;

  const displayFrame = mode === "live" ? frame : replayFrame;

  const durationMs =
    recordedFrames.length > 0
      ? recordedFrames[recordedFrames.length - 1].t
      : 0;
  const currentMs =
    mode === "replay" && recordedFrames.length > 0
      ? recordedFrames[replayIdx]?.t ?? 0
      : 0;

  return (
    <div className="flex h-full flex-col bg-zinc-950 border-l border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <GlobeIcon className="size-4 text-blue-400" />
          <span className="text-sm font-medium text-zinc-200">
            {mode === "live" ? "Live Browser" : "Session Replay"}
          </span>
          {mode === "live" && browserOpen && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Toggle between live/replay when replay is available */}
          {recordedFrames.length > 0 && (
            <button
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                mode === "replay"
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
              onClick={() => {
                if (mode === "live") {
                  setMode("replay");
                  setReplayIdx(0);
                  setPlaying(false);
                } else {
                  setMode("live");
                }
              }}
              type="button"
            >
              {mode === "replay" ? "Replay" : "Replay"}
            </button>
          )}
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            onClick={onClose}
            type="button"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Frame display */}
      <div className="flex-1 overflow-hidden bg-black flex items-center justify-center">
        {displayFrame ? (
          <img
            src={`data:image/jpeg;base64,${displayFrame}`}
            alt={mode === "live" ? "Live browser view" : "Replay frame"}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-zinc-600 text-sm flex flex-col items-center gap-2">
            <GlobeIcon className="size-8 text-zinc-700" />
            <span>{mode === "live" ? "Waiting for browser..." : "No frames"}</span>
          </div>
        )}
      </div>

      {/* Replay controls */}
      {mode === "replay" && recordedFrames.length > 0 && (
        <div className="shrink-0 border-t border-zinc-800 px-3 py-2 space-y-1.5">
          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={recordedFrames.length - 1}
            value={replayIdx}
            onChange={(e) => {
              setReplayIdx(Number(e.target.value));
              setPlaying(false);
            }}
            className="w-full h-1 appearance-none bg-zinc-800 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400"
          />
          {/* Time + controls */}
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (playing) {
                    setPlaying(false);
                    window.clearTimeout(playTimerRef.current);
                  } else {
                    // If at end, restart
                    if (replayIdx >= recordedFrames.length - 1) setReplayIdx(0);
                    setPlaying(true);
                  }
                }}
                className="rounded px-1.5 py-0.5 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium"
                type="button"
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                onClick={() => { setReplayIdx(0); setPlaying(false); }}
                className="text-zinc-500 hover:text-zinc-300"
                type="button"
              >
                Reset
              </button>
            </div>
            <span className="tabular-nums">
              {formatMs(currentMs)} / {formatMs(durationMs)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Main chat component
// ---------------------------------------------------------------------------

const Example = () => {
  const { data: session } = useSession();
  const [model, setModel] = useState<string>("openai/gpt-5.4-mini");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [text, setText] = useState<string>("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [browserPanelDismissed, setBrowserPanelDismissed] = useState(false);

  const { frame: browserFrame, browserOpen, recordedFrames } = useBrowserStream();
  const showBrowserPanel = (browserOpen || recordedFrames.length > 0) && !browserPanelDismissed;

  // Re-open browser panel when a new browser session starts
  const prevBrowserOpen = useRef(false);
  useEffect(() => {
    if (browserOpen && !prevBrowserOpen.current) {
      setBrowserPanelDismissed(false);
    }
    prevBrowserOpen.current = browserOpen;
  }, [browserOpen]);

  const { messages, sendMessage, status } = useChat<OrchestratorMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  // Build a map of all completed artifacts by toolCallId
  const artifactMap = useMemo(() => {
    const map = new Map<string, ArtifactData>();
    for (const message of messages) {
      const parts = message.parts as Array<{ type: string; [k: string]: unknown }>;
      for (const part of parts) {
        if (
          part.type === "tool-artifact" &&
          part.state === "output-available" &&
          part.toolCallId
        ) {
          map.set(part.toolCallId as string, part.output as ArtifactData);
        }
      }
    }
    return map;
  }, [messages]);

  const activeArtifact = activeArtifactId ? (artifactMap.get(activeArtifactId) ?? null) : null;

  // Track the id of the most recently completed artifact across all messages
  const latestArtifactId = useMemo(() => {
    let last: string | null = null;
    for (const message of messages) {
      const parts = message.parts as Array<{ type: string; [k: string]: unknown }>;
      for (const part of parts) {
        if (
          part.type === "tool-artifact" &&
          part.state === "output-available" &&
          part.toolCallId
        ) {
          last = part.toolCallId as string;
        }
      }
    }
    return last;
  }, [messages]);

  // Auto-open panel when a new artifact is generated
  const prevLatestArtifactIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (latestArtifactId && latestArtifactId !== prevLatestArtifactIdRef.current) {
      prevLatestArtifactIdRef.current = latestArtifactId;
      setActiveArtifactId(latestArtifactId);
      setPanelOpen(true);
    }
  }, [latestArtifactId]);

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === model),
    [model]
  );

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text?.trim());
      const hasAttachments = Boolean(message.files?.length);
      if (!(hasText || hasAttachments)) return;

      const fileParts = (message.files ?? []).map((f) => ({
        type: "file" as const,
        mediaType: f.type,
        url: f.url,
      }));

      sendMessage(
        {
          role: "user",
          parts: [
            ...(message.text ? [{ type: "text" as const, text: message.text }] : []),
            ...fileParts,
          ],
        },
        { body: { model } }
      );

      setText("");
    },
    [sendMessage, model]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage(
        { role: "user", parts: [{ type: "text", text: suggestion }] },
        { body: { model } }
      );
    },
    [sendMessage, model]
  );

  const handleTranscriptionChange = useCallback((transcript: string) => {
    setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
  }, []);

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    []
  );

  const handleModelSelect = useCallback((modelId: string) => {
    setModel(modelId);
    setModelSelectorOpen(false);
  }, []);

  const handlePanelClose = useCallback(() => setPanelOpen(false), []);

  const isSubmitDisabled = useMemo(
    () => !text.trim() || status === "streaming" || status === "submitted",
    [text, status]
  );

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col divide-y overflow-hidden">
        <Conversation>
          <ConversationContent>
            {messages.map((message) => {
              const parts = message.parts as Array<{ type: string; [k: string]: unknown }>;
              const sourceParts = parts.filter((p) => p.type === "source-url");
              const reasoningPart = parts.find((p) => p.type === "reasoning");
              const textParts = parts.filter((p) => p.type === "text");
              const researchParts = parts.filter((p) => p.type === "tool-research");
              const artifactParts = parts.filter((p) => p.type === "tool-artifact");
              const bashParts = parts.filter((p) => p.type === "tool-bash");
              const browserParts = parts.filter((p) => p.type === "tool-browser");
              const loadSkillParts = parts.filter((p) => p.type === "tool-loadSkill");

              return (
                <Message from={message.role === "user" ? "user" : "assistant"} key={message.id}>
                  <div>
                    {sourceParts.length > 0 && (
                      <Sources>
                        <SourcesTrigger count={sourceParts.length} />
                        <SourcesContent>
                          {sourceParts.map((part, i) => (
                            <Source
                              href={String(part.url ?? "")}
                              key={String(part.url ?? i)}
                              title={String(part.title ?? "")}
                            />
                          ))}
                        </SourcesContent>
                      </Sources>
                    )}
                    {reasoningPart != null && reasoningPart.text != null ? (
                      <Reasoning>
                        <ReasoningTrigger />
                        <ReasoningContent>{String(reasoningPart.text)}</ReasoningContent>
                      </Reasoning>
                    ) : null}

                    {loadSkillParts.map((part, i) => (
                      <LoadSkillToolPart key={String(part.toolCallId ?? i)} part={part} />
                    ))}

                    {researchParts.map((part, i) => (
                      <ResearchToolPart key={String(part.toolCallId ?? i)} part={part} />
                    ))}

                    {bashParts.map((part, i) => (
                      <SandboxToolPart key={String(part.toolCallId ?? i)} part={part} />
                    ))}

                    {browserParts.map((part, i) => (
                      <BrowserToolPart key={String(part.toolCallId ?? i)} part={part} />
                    ))}

                    {artifactParts.map((part) => {
                      const toolCallId = part.toolCallId as string | undefined;
                      return (
                        <ArtifactToolPart
                          key={String(toolCallId ?? part.type)}
                          onOpen={() => {
                            if (toolCallId) {
                              setActiveArtifactId(toolCallId);
                              setPanelOpen(true);
                            }
                          }}
                          part={part as { type: string; state?: string; input?: unknown; toolCallId?: string }}
                        />
                      );
                    })}

                    <MessageContent>
                      {textParts.map((part, i) =>
                        part.text ? (
                          <MessageResponse key={i}>{String(part.text)}</MessageResponse>
                        ) : null
                      )}
                    </MessageContent>
                  </div>
                </Message>
              );
            })}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="grid shrink-0 gap-4 pt-4">
          {messages.length === 0 && (
            <Suggestions className="px-4">
              {suggestions.map((suggestion) => (
                <SuggestionItem
                  key={suggestion}
                  onClick={handleSuggestionClick}
                  suggestion={suggestion}
                />
              ))}
            </Suggestions>
          )}
          <div className="w-full px-4 pb-4">
            <PromptInput globalDrop multiple onSubmit={handleSubmit}>
              <PromptInputHeader>
                <PromptInputAttachmentsDisplay />
              </PromptInputHeader>
              <PromptInputBody>
                <PromptInputTextarea onChange={handleTextChange} value={text} />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                  <SpeechInput
                    className="shrink-0"
                    onTranscriptionChange={handleTranscriptionChange}
                    size="icon-sm"
                    variant="ghost"
                  />
                  <ModelSelector
                    onOpenChange={setModelSelectorOpen}
                    open={modelSelectorOpen}
                  >
                    <ModelSelectorTrigger asChild>
                      <PromptInputButton>
                        {selectedModelData?.chefSlug && (
                          <ModelSelectorLogo
                            provider={selectedModelData.chefSlug}
                          />
                        )}
                        {selectedModelData?.name && (
                          <ModelSelectorName>
                            {selectedModelData.name}
                          </ModelSelectorName>
                        )}
                      </PromptInputButton>
                    </ModelSelectorTrigger>
                    <ModelSelectorContent>
                      <ModelSelectorInput placeholder="Search models..." />
                      <ModelSelectorList>
                        <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                        {chefs.map((chef) => (
                          <ModelSelectorGroup heading={chef} key={chef}>
                            {models
                              .filter((m) => m.chef === chef)
                              .map((m) => (
                                <ModelItem
                                  isSelected={model === m.id}
                                  key={m.id}
                                  m={m}
                                  onSelect={handleModelSelect}
                                />
                              ))}
                          </ModelSelectorGroup>
                        ))}
                      </ModelSelectorList>
                    </ModelSelectorContent>
                  </ModelSelector>
                </PromptInputTools>
                <PromptInputSubmit disabled={isSubmitDisabled} status={status} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>

      {/* Browser live preview — takes priority over artifact panel */}
      {showBrowserPanel ? (
        <div className="w-[45%] shrink-0 overflow-hidden">
          <BrowserPanel frame={browserFrame} browserOpen={browserOpen} recordedFrames={recordedFrames} onClose={() => setBrowserPanelDismissed(true)} />
        </div>
      ) : panelOpen && activeArtifact ? (
        <div className="w-[45%] shrink-0 overflow-hidden border-l">
          <ArtifactPanel artifact={activeArtifact} onClose={handlePanelClose} />
        </div>
      ) : null}
    </div>
  );
};

export default Example;
