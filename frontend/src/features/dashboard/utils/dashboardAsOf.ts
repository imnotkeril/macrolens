import { format, isValid, parseISO } from "date-fns";
import type { NavigatorRecommendation, RegimeSnapshot } from "@/types";

/** Calendar day for monospace sidebar (yyyy-MM-dd). */
export function formatDashboardAsOfLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "—";

  let d = parseISO(trimmed);
  if (!isValid(d) && trimmed.length >= 10 && trimmed[4] === "-" && trimmed[7] === "-") {
    d = parseISO(trimmed.slice(0, 10));
  }

  return isValid(d) ? format(d, "yyyy-MM-dd") : trimmed.slice(0, Math.min(32, trimmed.length));
}

/**
 * Freshness stamp for Next dashboard sidebar.
 * Mirrors legacy Trading Navigator sidebar (`page.tsx`): `NavigatorTerminalChrome dataAsOf={regime?.timestamp}` first,
 * then navigator bundle fields (`/api/navigator/current`).
 */
export function deriveDashboardUpdatedAtLabel(opts: {
  regime: RegimeSnapshot | undefined;
  navigator: NavigatorRecommendation | undefined;
  regimePending: boolean;
  navigatorPending: boolean;
}): string {
  const raw =
    opts.regime?.timestamp?.trim() ??
    opts.navigator?.position?.date?.trim() ??
    opts.navigator?.phase_context?.as_of_date?.trim() ??
    opts.navigator?.ensemble?.as_of_date?.trim() ??
    null;

  if (raw) return formatDashboardAsOfLabel(raw);
  if (opts.regimePending && opts.navigatorPending) return "…";
  return "—";
}
