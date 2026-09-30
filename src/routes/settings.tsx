import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DemoBadge } from "@/components/vyora/StatusPill";
import { useVyora } from "@/lib/vyora/store";
import type { RecordingSeconds } from "@/lib/vyora/types";

const LENGTHS: RecordingSeconds[] = [4, 6, 10, 15];

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "VYORA — Settings" },
      {
        name: "description",
        content:
          "Choose spoken replies, microphone, and clip length, and review the local models VYORA uses.",
      },
      { property: "og:title", content: "VYORA — Settings" },
      {
        property: "og:description",
        content: "Spoken replies, microphone, clip length, and local model information.",
      },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const {
    settings,
    updateSettings,
    microphones,
    status,
    isDemo,
    disconnect,
    loadSpeechModel,
    state,
    busy,
    canDownloadSpeechModel,
  } = useVyora();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Settings</h1>
        {isDemo && <DemoBadge />}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <Section title="Replies">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="spoken-replies">Spoken replies</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                When on, replies are spoken by the local Python assistant, not the browser.
              </p>
            </div>
            <button
              id="spoken-replies"
              type="button"
              role="switch"
              aria-checked={settings.spokenReplies}
              onClick={() => updateSettings({ spokenReplies: !settings.spokenReplies })}
              disabled={busy}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                settings.spokenReplies
                  ? "border-primary/50 bg-primary/40"
                  : "border-border bg-surface-raised"
              }`}
            >
              <span className="sr-only">Spoken replies</span>
              <span
                aria-hidden="true"
                className={`absolute top-0.5 size-4.5 rounded-full bg-foreground transition-all ${
                  settings.spokenReplies ? "left-[1.4rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </Section>

        <Section title="Microphone">
          <Label htmlFor="microphone">Input device</Label>
          <select
            id="microphone"
            value={settings.microphoneId ?? ""}
            onChange={(event) => updateSettings({ microphoneId: event.target.value })}
            disabled={busy}
            className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
          >
            {microphones.map((mic) => (
              <option key={mic.id} value={mic.id}>
                {mic.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Device list comes from the local backend, which owns audio capture.
          </p>
        </Section>

        <Section title="Recording length">
          <div role="radiogroup" aria-label="Recording length" className="flex flex-wrap gap-2">
            {LENGTHS.map((seconds) => {
              const selected = settings.recordingSeconds === seconds;
              return (
                <button
                  key={seconds}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => updateSettings({ recordingSeconds: seconds })}
                  disabled={busy}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    selected
                      ? "border-primary/50 bg-primary/15 text-foreground"
                      : "border-border bg-surface-raised text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {seconds} s
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Models">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Backend version</dt>
              <dd className="font-mono">{status?.backendVersion ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">AI model</dt>
              <dd className="font-mono">
                {status?.aiModel ? `${status.aiModel.name} · ${status.aiModel.loaded ? "loaded" : "not loaded"}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Speech model</dt>
              <dd className="font-mono">
                {status?.speechModel
                  ? `${status.speechModel.name} · ${status.speechModel.downloaded ? "downloaded" : "not downloaded"}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Speech model size</dt>
              <dd className="font-mono">
                {status?.speechModel ? `${status.speechModel.sizeMb} MB` : "—"}
              </dd>
            </div>
          </dl>
          {status?.speechModel &&
            !status.speechModel.downloaded &&
            (canDownloadSpeechModel ? (
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() => void loadSpeechModel()}
                disabled={busy}
              >
                {state === "loading-model" ? "Loading speech model…" : "Download speech model"}
              </Button>
            ) : (
              <p className="mt-4 rounded-lg border border-border bg-surface-raised p-3 text-xs text-muted-foreground">
                The speech model is not installed yet. It is managed by your local assistant
                service, so install it there — VYORA cannot fetch it from this screen.
              </p>
            ))}
        </Section>

        <Section title="Connection">
          <p className="text-xs text-muted-foreground">
            Disconnecting clears the connection token from this browser session.
          </p>
          <Button className="mt-4" variant="destructive" disabled={busy} onClick={() => void disconnect()}>
            Disconnect
          </Button>
          {busy && <p className="mt-2 text-xs text-warning">Stop the current action before changing settings or disconnecting.</p>}
        </Section>
      </div>
    </main>
  );
}
