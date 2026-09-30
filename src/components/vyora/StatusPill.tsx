import { cn } from "@/lib/utils";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border text-muted-foreground",
  good: "border-success/40 text-success",
  warn: "border-warning/40 text-warning",
  bad: "border-destructive/40 text-destructive",
  info: "border-violet/40 text-violet",
};

export function StatusPill({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-surface-raised/60 px-3 py-1 text-xs font-medium tracking-wide",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning",
        className,
      )}
    >
      Demo mode
    </span>
  );
}
