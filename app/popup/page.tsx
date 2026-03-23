"use client";

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
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import type { OrchestratorMessage } from "@/lib/agents";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MaximizeIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

declare global {
  interface Window {
    electronAPI?: { isElectron: boolean; openMainWindow: () => void };
  }
}

export default function PopupPage() {
  const [text, setText] = useState("");

  const { messages, sendMessage, status } = useChat<OrchestratorMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (!message.text?.trim()) return;
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: message.text }],
      });
      setText("");
    },
    [sendMessage]
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    []
  );

  const isSubmitDisabled = useMemo(
    () => !text.trim() || status === "streaming" || status === "submitted",
    [text, status]
  );

  const isElectron =
    typeof window !== "undefined" && window.electronAPI?.isElectron;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      {/* Draggable title bar area for frameless window */}
      <div className="flex h-10 shrink-0 items-center justify-between px-3" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
        <span className="text-xs font-medium text-muted-foreground">
          AI Chatbot
        </span>
        {isElectron && (
          <button
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => window.electronAPI?.openMainWindow()}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            title="Open full app"
            type="button"
          >
            <MaximizeIcon className="size-3.5" />
          </button>
        )}
      </div>

      {/* Chat */}
      <div className="flex min-h-0 flex-1 flex-col divide-y overflow-hidden">
        <Conversation>
          <ConversationContent>
            {messages.map((message) => {
              const parts = message.parts as Array<{
                type: string;
                [k: string]: unknown;
              }>;
              const reasoningPart = parts.find((p) => p.type === "reasoning");
              const textParts = parts.filter((p) => p.type === "text");

              return (
                <Message
                  from={message.role === "user" ? "user" : "assistant"}
                  key={message.id}
                >
                  <div>
                    {reasoningPart != null && reasoningPart.text != null ? (
                      <Reasoning>
                        <ReasoningTrigger />
                        <ReasoningContent>
                          {String(reasoningPart.text)}
                        </ReasoningContent>
                      </Reasoning>
                    ) : null}

                    <MessageContent>
                      {textParts.map((part, i) =>
                        part.text ? (
                          <MessageResponse key={i}>
                            {String(part.text)}
                          </MessageResponse>
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

        <div className="shrink-0 p-3">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                onChange={handleTextChange}
                placeholder="Ask anything..."
                value={text}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <div />
              <PromptInputSubmit
                disabled={isSubmitDisabled}
                status={status}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
