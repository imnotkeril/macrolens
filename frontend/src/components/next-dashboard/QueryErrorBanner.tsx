"use client";

type Palette = { border: string; red: string; soft: string; muted: string };

type QueryErrorBannerProps = {
  colors: Palette;
  title?: string;
  errors: Array<{ label: string; message: string }>;
  onRetry?: () => void;
};

export function QueryErrorBanner({ colors, title = "Some data failed to load", errors, onRetry }: QueryErrorBannerProps) {
  if (!errors.length) return null;
  return (
    <div
      className="rounded-[2px] border px-3 py-2 text-[12px] leading-snug"
      style={{ borderColor: colors.red, background: colors.soft + "14", color: colors.soft }}
      role="alert"
    >
      <div className="font-semibold uppercase tracking-[0.06em]" style={{ color: colors.red }}>
        {title}
      </div>
      <ul className="mt-2 list-inside list-disc space-y-1" style={{ color: colors.muted }}>
        {errors.map((e) => (
          <li key={e.label}>
            <span className="font-medium" style={{ color: colors.soft }}>
              {e.label}:
            </span>{" "}
            {e.message}
          </li>
        ))}
      </ul>
      {onRetry ? (
        <button
          type="button"
          className="mt-2 rounded-[2px] border px-2 py-1 text-[11px] uppercase tracking-[0.08em] transition-opacity hover:opacity-90"
          style={{ borderColor: colors.border, color: colors.soft }}
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
