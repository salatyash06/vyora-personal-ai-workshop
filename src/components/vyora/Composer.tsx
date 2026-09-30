import { useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";

import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { useVyora } from "@/lib/vyora/store";

const SUGGESTIONS = [
  "what is my cpu usage",
  "save note: call the supplier tomorrow",
  "summarise my open notes",
  "how much battery is left",
];

export function Composer() {
  const { draft, setDraft, record, stop, send, state, busy, status, settings } = useVyora();
  const speechReady = status?.speechModel?.downloaded ?? false;
  const canSend = draft.trim().length > 0 && !busy;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatStatus = state === "thinking" ? "submitted" : busy ? "streaming" : state === "error" ? "error" : "ready";

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  return (
    <div className="sticky bottom-0 z-20 flex min-w-0 flex-col gap-3 border-t border-border bg-background/95 px-3 py-3 backdrop-blur sm:px-5">
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Suggested commands">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDraft(suggestion)}
            disabled={busy}
            className="shrink-0 rounded-full bg-surface-raised text-muted-foreground"
          >
            {suggestion}
          </Button>
        ))}
      </div>

      <PromptInput
        className="mx-auto w-full max-w-3xl bg-input"
        onSubmit={() => {
          void send();
        }}
      >
        <label htmlFor="composer" className="sr-only">
          Message VYORA
        </label>
        <PromptInputTextarea
          ref={inputRef}
          id="composer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder="Type a command, or record a clip and review the transcript before sending."
          className="min-w-0"
        />

        <PromptInputFooter className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
          <PromptInputTools className="min-w-0 overflow-x-auto">
          <PromptInputButton
            type="button"
            variant="secondary"
            onClick={() => void record()}
            disabled={busy || !speechReady}
            title={
              speechReady
                ? `Records about ${settings.recordingSeconds} seconds`
                : "Load the speech model in Settings first"
            }
          >
            <Mic className="size-4" aria-hidden="true" />
            Record
          </PromptInputButton>
          </PromptInputTools>
          {busy ? (
          <Button
            type="button"
            variant="destructive"
            onClick={stop}
            className="shrink-0"
            title="Stop the current action"
          >
            <Square className="size-4" aria-hidden="true" />
            Stop
          </Button>
          ) : (
            <PromptInputSubmit status={chatStatus} disabled={!canSend} className="shrink-0" />
          )}
        </PromptInputFooter>

        {!speechReady && (
          <p className="text-xs text-muted-foreground">
            Record is disabled until the speech model is downloaded. Open Settings to load it.
          </p>
        )}
        {state === "listening" && (
          <p className="text-xs text-accent">
            Recording for about {settings.recordingSeconds} seconds. Audio capture runs in the local
            Python assistant.
          </p>
        )}
      </PromptInput>
    </div>
  );
}
