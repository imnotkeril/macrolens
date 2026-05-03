"use client";

export function FedPolicyCompactMetric({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor: string;
}) {
  return (
    <div
      className="flex min-h-[5.25rem] items-center justify-between gap-3 rounded-[2px] border px-3 py-2.5"
      style={{ borderColor: "var(--nd-border-soft)", background: "var(--nd-panel-soft)" }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
          {label}
        </div>
        <div className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--nd-muted)" }}>
          {sub}
        </div>
      </div>
      <div className="shrink-0 text-right text-[15px] font-semibold tabular-nums leading-tight" style={{ color: valueColor }}>
        {value}
      </div>
    </div>
  );
}
