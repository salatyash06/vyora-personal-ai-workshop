import { Link } from "@tanstack/react-router";
import { MessageSquare, NotebookPen, Settings, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/vyora/format";
import { useVyora } from "@/lib/vyora/store";
import { DemoBadge } from "./StatusPill";

const NAV = [
  { to: "/", label: "Assistant", icon: MessageSquare },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const { conversations, status, isDemo, newConversation, selectConversation, busy } = useVyora();
  const connected = status?.connected ?? false;

  return (
    <nav
      aria-label="Main"
      className="flex h-full w-full flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4"
    >
      <div className="flex items-center justify-between">
        <Link to="/" className="rounded-md text-lg font-semibold tracking-[0.22em] text-glow">
          VYORA
        </Link>
        {isDemo && <DemoBadge />}
      </div>

      <Button
        onClick={newConversation}
        disabled={busy}
        title={busy ? "Wait for the current action to finish or stop it first" : undefined}
        className="justify-start gap-2 bg-primary/15 text-primary hover:bg-primary/25"
        variant="ghost"
      >
        <Plus className="size-4" aria-hidden="true" />
        New conversation
      </Button>

      <ul className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "bg-surface-raised text-foreground" }}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <h2 className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Recent conversations
        </h2>
        {conversations.length === 0 ? (
          <p className="px-3 text-xs text-muted-foreground">
            {connected ? "No conversations yet." : "Connect to load your conversations."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => selectConversation(conversation.id)}
                  className="h-auto w-full min-w-0 justify-start px-3 py-2 text-left text-sm text-muted-foreground"
                  title={busy ? "Conversation switching is paused during an active request" : undefined}
                >
                  <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground/80">{conversation.title}</span>
                  <span className="text-[11px]">{formatRelative(conversation.updatedAt)}</span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-sidebar-border bg-surface/60 px-3 py-2 text-xs">
        <span className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${connected ? "bg-success" : "bg-destructive"}`}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">
            Backend {connected ? "connected" : "not connected"}
          </span>
        </span>
      </div>
    </nav>
  );
}
