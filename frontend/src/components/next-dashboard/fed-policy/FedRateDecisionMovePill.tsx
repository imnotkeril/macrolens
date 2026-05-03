"use client";

export function FedRateDecisionMovePill({ decision }: { decision: string }) {
  if (decision === "Hold") {
    return (
      <span
        className="inline-block min-w-[4rem] rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
        style={{
          background: "color-mix(in srgb, var(--nd-soft) 22%, transparent)",
          color: "var(--nd-soft)",
        }}
      >
        Hold
      </span>
    );
  }
  if (decision === "Cut") {
    return (
      <span
        className="inline-block min-w-[4rem] rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
        style={{
          background: "color-mix(in srgb, var(--nd-green) 28%, transparent)",
          color: "var(--nd-green)",
        }}
      >
        Cut
      </span>
    );
  }
  return (
    <span
      className="inline-block min-w-[4rem] rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
      style={{
        background: "color-mix(in srgb, var(--nd-red) 26%, transparent)",
        color: "var(--nd-red)",
      }}
    >
      Hike
    </span>
  );
}
