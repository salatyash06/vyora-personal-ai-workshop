import { Progress } from "@/components/ui/progress";
import { useVyora } from "@/lib/vyora/store";
import { DemoBadge, StatusPill } from "./StatusPill";

function Metric({ label, value, simulated }: { label: string; value: number | null; simulated: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="min-w-0 text-muted-foreground">{label}{simulated ? " · simulated" : ""}</span>
        <span className="font-mono tabular-nums">{value === null ? "—" : `${value}%`}</span>
      </div>
      <Progress value={value ?? 0} className="mt-2 h-1.5 bg-surface-raised" />
    </div>
  );
}

export function RightPanel() {
  const { telemetry, status, isDemo } = useVyora();
  const connected = status?.connected ?? false;

  return (
    <aside aria-label="System status" className="flex h-full flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          System
        </h2>
        {isDemo && <DemoBadge />}
      </div>

      {!connected ? (
        <p className="text-sm text-muted-foreground">
          Live CPU, memory and battery readings appear here once the local backend is connected.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {!telemetry && <p className="text-sm text-muted-foreground">Loading system readings…</p>}
          <Metric label="CPU" value={telemetry?.cpuPercent ?? null} simulated={isDemo} />
          <Metric label="RAM" value={telemetry?.ramPercent ?? null} simulated={isDemo} />
          <Metric label="Battery" value={telemetry?.batteryPercent ?? null} simulated={isDemo} />
          {telemetry?.batteryCharging && (
            <p className="text-xs text-muted-foreground">Charging</p>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Backend</span>
          <StatusPill
            label={connected ? "Connected" : "Offline"}
            tone={connected ? "good" : "bad"}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">AI model</span>
          <StatusPill
            label={status?.aiModel ? (status.aiModel.loaded ? "Loaded" : "Not loaded") : "Unknown"}
            tone={status?.aiModel?.loaded ? "good" : "neutral"}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Speech model</span>
          <StatusPill
            label={
              status?.speechModel
                ? status.speechModel.downloaded
                  ? "Downloaded"
                  : "Not downloaded"
                : "Unknown"
            }
            tone={status?.speechModel?.downloaded ? "good" : "warn"}
          />
        </div>
        {status?.speechModel && (
          <p className="text-xs text-muted-foreground">
            {status.speechModel.name} · {status.speechModel.sizeMb} MB
          </p>
        )}
      </div>
    </aside>
  );
}
