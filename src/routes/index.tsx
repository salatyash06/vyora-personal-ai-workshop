import { createFileRoute } from "@tanstack/react-router";

import { ChatMessages } from "@/components/vyora/ChatMessages";
import { Composer } from "@/components/vyora/Composer";
import { Orb } from "@/components/vyora/Orb";
import { RightPanel } from "@/components/vyora/RightPanel";
import { DemoBadge } from "@/components/vyora/StatusPill";
import { useVyora } from "@/lib/vyora/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VYORA — Assistant" },
      {
        name: "description",
        content:
          "Talk to VYORA, your local Windows AI assistant. Record a clip, review the transcript, and send it.",
      },
      { property: "og:title", content: "VYORA — Assistant" },
      {
        property: "og:description",
        content: "Your voice. Your workspace. Your assistant.",
      },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { state, statusMessage, errorMessage, isDemo, messages } = useVyora();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden md:h-full xl:flex-row">
      <main className="flex min-h-[70vh] min-w-0 flex-1 flex-col overflow-hidden md:min-h-0">
        <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <Orb state={state} size={44} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">Assistant</h1>
              {isDemo && <DemoBadge />}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground" aria-live="polite">
              {statusMessage}
              {errorMessage ? ` — ${errorMessage}` : ""}
            </p>
          </div>
        </header>

        <ChatMessages messages={messages} state={state} />
        <Composer />
      </main>

      <div className="border-t border-border xl:w-80 xl:shrink-0 xl:border-l xl:border-t-0">
        <RightPanel />
      </div>
    </div>
  );
}
