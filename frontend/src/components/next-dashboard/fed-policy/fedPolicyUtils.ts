import type { BalanceSheet, FedRate } from "@/types";

/** Fallback when API has not yet returned `neutral_rate_nominal` (should be rare). */
export const R_STAR_FALLBACK = 2.5;
/** @deprecated Use `neutral_rate_nominal` from `/api/fed/current` or `R_STAR_FALLBACK`. */
export const R_STAR = R_STAR_FALLBACK;

export function fedRateMid(r: FedRate): number {
  return (r.target_upper + r.target_lower) / 2;
}

/** Normalized rate-vs-neutral contribution in [-1, 1], aligned with backend FedTracker. */
export function rateVsRStarComponent(mid: number, neutralNominal: number = R_STAR_FALLBACK): number {
  const n = neutralNominal > 0.25 ? neutralNominal : R_STAR_FALLBACK;
  return Math.max(-1, Math.min(1, (mid - n) / n));
}

export function directionScoreLabel(direction: string): { label: string; delta: number } {
  const d = direction.toLowerCase();
  if (d === "hiking") return { label: "Hiking", delta: 0.5 };
  if (d === "cutting") return { label: "Cutting", delta: -0.5 };
  return { label: "Pausing", delta: 0 };
}

export function balanceSheetScoreLabel(direction: string): { label: string; delta: number } {
  const d = direction.toLowerCase();
  if (d === "shrinking") return { label: "QT", delta: 0.5 };
  if (d === "expanding") return { label: "QE", delta: -0.5 };
  return { label: "Stable", delta: 0 };
}

export function buildRateChangeRows(rates: FedRate[], limit = 16) {
  if (!rates.length) return [];
  const sorted = [...rates].sort((a, b) => a.date.localeCompare(b.date));
  const milestones: FedRate[] = [];
  for (const r of sorted) {
    const last = milestones[milestones.length - 1];
    if (!last || last.target_upper !== r.target_upper || last.target_lower !== r.target_lower) {
      milestones.push(r);
    }
  }
  if (milestones.length < 2) return [];
  const tail = milestones.slice(-(limit + 1));
  const rows: Array<{
    date: string;
    decision: string;
    bps: number;
    rangeAfter: string;
    signal: string;
  }> = [];
  for (let i = 1; i < tail.length; i += 1) {
    const prev = tail[i - 1];
    const cur = tail[i];
    const midPrev = fedRateMid(prev);
    const midCur = fedRateMid(cur);
    const bps = Math.round((midCur - midPrev) * 100);
    const decision = bps > 0 ? "Hike" : bps < 0 ? "Cut" : "Hold";
    const phrase = cur.fomc_signal_phrase?.trim();
    const signal =
      phrase && phrase.length > 0
        ? phrase.length > 220
          ? `${phrase.slice(0, 217)}…`
          : phrase
        : decision === "Hold"
          ? "pausing"
          : decision === "Cut"
            ? "easing"
            : "tightening";
    rows.push({
      date: cur.date,
      decision,
      bps,
      rangeAfter: `${cur.target_lower.toFixed(2)}–${cur.target_upper.toFixed(2)}%`,
      signal,
    });
  }
  return rows.reverse();
}

export type RateDecisionHistoryRow = ReturnType<typeof buildRateChangeRows>[number];

export function computeBsMetrics(balanceSheet: BalanceSheet[] | undefined) {
  if (!balanceSheet?.length) return null;
  const sorted = [...balanceSheet].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const peakAssets = Math.max(...sorted.map((b) => b.total_assets));
  const peakDate = sorted.find((b) => b.total_assets === peakAssets)?.date ?? "";

  let qtPace: number | null = null;
  if (sorted.length >= 5) {
    const recent = sorted.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 0) {
      qtPace = ((first.total_assets - last.total_assets) / daysDiff) * 30;
    }
  }

  return {
    totalAssets: latest.total_assets,
    treasuries: latest.treasuries,
    mbs: latest.mbs,
    reserves: latest.reserves,
    peakAssets,
    peakDate: peakDate.slice(0, 7),
    qtPaceMonthly: qtPace,
    latestDate: latest.date,
  };
}

export type BalanceSheetMetricsSnapshot = NonNullable<ReturnType<typeof computeBsMetrics>>;

export type BalanceStackRow = {
  date: string;
  treasuries: number;
  mbs: number;
  reserves: number;
  other: number;
  total: number;
};

export function balanceStackFromRows(balanceSheet: BalanceSheet[]): BalanceStackRow[] {
  if (!balanceSheet.length) return [];
  return [...balanceSheet].reverse().map((b) => {
    const t = b.treasuries ?? 0;
    const m = b.mbs ?? 0;
    const r = b.reserves ?? 0;
    const total = b.total_assets;
    const sumCore = t + m + r;
    let treasuries = t;
    let mbs = m;
    let reserves = r;
    // When core lines sum above reported total (definitions / rounding / feed mismatch),
    // "other" would clamp to 0 and the stack would exceed the Total line. Scale proportionally.
    if (total > 0 && sumCore > total) {
      const k = total / sumCore;
      treasuries = t * k;
      mbs = m * k;
      reserves = r * k;
    }
    const other = Math.max(0, total - treasuries - mbs - reserves);
    return { date: b.date, treasuries, mbs, reserves, other, total };
  });
}
