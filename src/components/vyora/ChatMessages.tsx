import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { formatDateTime } from "@/lib/vyora/format";
import type { AssistantState, ChatMessage } from "@/lib/vyora/types";

/** Messages render as escaped text only — no HTML injection. */
export function ChatMessages({ messages, state }: { messages: ChatMessage[]; state: AssistantState }) {
  const waiting = state === "thinking" && messages.at(-1)?.role === "user";
  return (
    <Conversation className="min-h-0 w-full min-w-0" aria-label="Conversation">
      <ConversationContent className="mx-auto min-h-full w-full max-w-3xl gap-5 px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <ConversationEmptyState
            title="Ready when you are"
            description="Ask something, or record a short clip. VYORA will place the transcript in the composer for review before sending."
          />
        ) : messages.map((message) => (
          <Message key={message.id} from={message.role} className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{message.role === "user" ? "You" : "VYORA"}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
            </div>
            <MessageContent
              className={
                message.role === "user"
                  ? "max-w-[min(38rem,90%)] rounded-lg bg-primary px-4 py-3 text-primary-foreground"
                  : "w-full max-w-[46rem] overflow-visible bg-transparent p-0"
              }
            >
              <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
            </MessageContent>
          </Message>
        ))}
        {waiting && (
          <Message from="assistant">
            <MessageContent className="bg-transparent p-0">
              <Shimmer className="text-sm">Thinking…</Shimmer>
            </MessageContent>
          </Message>
        )}
      </ConversationContent>
      <ConversationScrollButton aria-label="Jump to latest message" />
    </Conversation>
  );
}
