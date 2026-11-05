import type { CSSProperties } from "react";

export const NO_DATA_TITLE = "No data yet";
export const NO_DATA_HINT = "Data loads after the first refresh.";

/**
 * Shared explicit empty state (D-05): short text + hint instead of default values shown as facts.
 * Theme-aware via --nd-* tokens; `compact` for inline slots inside a panel.
 */
export function NextNoData({
  hint = NO_DATA_HINT,
  compact = false,
  className = "",
  style,
}: {
  hint?: string;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      role="status"
      className={`flex w-full flex-col items-center justify-center text-center ${
        compact ? "gap-0.5 py-3" : "min-h-[120px] flex-1 gap-1 py-6"
      } ${className}`}
      style={style}
    >
      <div className="text-[13px] uppercase tracking-[0.08em]" style={{ color: "var(--nd-soft)" }}>
        {NO_DATA_TITLE}
      </div>
      <div className="text-[12px]" style={{ color: "var(--nd-muted)" }}>
        {hint}
      </div>
    </div>
  );
}
