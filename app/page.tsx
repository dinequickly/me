"use client";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
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
import type { OrchestratorMessage } from "@/lib/agents";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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
// Main chat component
// ---------------------------------------------------------------------------

const Example = () => {
  const [model, setModel] = useState<string>("anthropic/claude-haiku-4.5");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [text, setText] = useState<string>("");

  const { messages, sendMessage, status } = useChat<OrchestratorMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

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

  const isSubmitDisabled = useMemo(
    () => !text.trim() || status === "streaming" || status === "submitted",
    [text, status]
  );

  return (
    <div className="relative flex h-dvh w-full flex-col divide-y overflow-hidden">
      <Conversation>
        <ConversationContent>
          {messages.map((message) => {
            // Cast parts to any[] since the typed union doesn't include
            // runtime-added part types like source-url and reasoning
            const parts = message.parts as Array<{ type: string; [k: string]: unknown }>;
            const sourceParts = parts.filter(
              (p) => p.type === "source-url"
            );
            const reasoningPart = parts.find(
              (p) => p.type === "reasoning"
            );
            const textParts = parts.filter((p) => p.type === "text");
            const toolParts = parts.filter((p) =>
              p.type.startsWith("tool-")
            );

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

                  {/* Render research tool parts */}
                  {toolParts.map((part, i) => (
                    <ResearchToolPart key={String(part.toolCallId ?? i)} part={part} />
                  ))}

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
  );
};

export default Example;
