import type { AssistantState } from "@/lib/vyora/types";

const STATE_COLOR: Record<AssistantState, string> = {
  disconnected: "var(--muted-foreground)",
  ready: "var(--primary)",
  "loading-model": "var(--violet)",
  listening: "var(--accent)",
  transcribing: "var(--accent)",
  thinking: "var(--violet)",
  speaking: "var(--primary)",
  stopped: "var(--warning)",
  error: "var(--destructive)",
};

/** Lightweight CSS/SVG assistant orb — no 3D scene, no particle loop. */
export function Orb({ state, size = 56 }: { state: AssistantState; size?: number }) {
  const color = STATE_COLOR[state];
  const active = state !== "disconnected" && state !== "stopped" && state !== "error";
  const pulsing = state === "listening" || state === "speaking";

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {pulsing && (
        <span
          className="vyora-ripple absolute inset-0 rounded-full"
          style={{ border: `1px solid ${color}` }}
        />
      )}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={active ? "vyora-breathe" : undefined}
      >
        <defs>
          <radialGradient id="vyora-orb" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="55%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.06" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="34" fill="url(#vyora-orb)" />
        <circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeOpacity="0.45" />
        <g
          className={state === "thinking" || state === "loading-model" ? "vyora-spin-slow" : undefined}
          style={{ transformOrigin: "50px 50px" }}
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={color}
            strokeOpacity="0.35"
            strokeDasharray="6 12"
          />
        </g>
      </svg>
    </div>
  );
}
