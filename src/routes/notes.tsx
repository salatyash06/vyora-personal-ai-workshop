import { createFileRoute } from "@tanstack/react-router";

import { DemoBadge } from "@/components/vyora/StatusPill";
import { formatDateTime } from "@/lib/vyora/format";
import { useVyora } from "@/lib/vyora/store";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "VYORA — Notes" },
      {
        name: "description",
        content: "Notes VYORA saved for you, captured by saying or typing 'save note: …' in chat.",
      },
      { property: "og:title", content: "VYORA — Notes" },
      {
        property: "og:description",
        content: "Every note VYORA captured from your conversations.",
      },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { notes, isDemo } = useVyora();

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden px-5 py-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex">
        <h1 className="text-xl font-semibold">Notes</h1>
        {isDemo && <DemoBadge />}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Notes are saved from the Assistant screen: type or say{" "}
        <span className="font-mono text-foreground">save note: your text</span> and VYORA stores it.
        There is no manual add button here on purpose.
      </p>

      {notes.length === 0 ? (
        <p className="mt-8 rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          No notes yet.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {note.content}
              </p>
              <time
                dateTime={note.createdAt}
                className="mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {formatDateTime(note.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
