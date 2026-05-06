/**
 * Display copy for curve classifier (`YieldAnalyzer._classify_pattern`).
 * Mechanics line matches user-facing macro intuition; positioning is actionable guidance.
 */
export type YieldCurvePatternId =
  | "bear_steepening"
  | "bull_steepening"
  | "bear_flattening"
  | "bull_flattening"
  | "stable"
  | "mixed";

type PatternUi = {
  label: string;
  mechanics: string;
  coloring: "yellow" | "green" | "red" | "blue" | "muted";
  positioning: string;
};

export const YIELD_CURVE_PATTERN_UI: Record<YieldCurvePatternId, PatternUi> = {
  bear_steepening: {
    label: "Bear Steepening",
    mechanics: "All rates UP, long end rises MORE. Growth + inflation expectations rising.",
    coloring: "yellow",
    positioning: "Sell long bonds, buy commodities.",
  },
  bull_steepening: {
    label: "Bull Steepening",
    mechanics: "All rates DOWN, short end falls MORE. Fed cutting; recovery expectations.",
    coloring: "green",
    positioning: "Buy long bonds, buy risk assets.",
  },
  bear_flattening: {
    label: "Bear Flattening",
    mechanics: "All rates UP, short end rises MORE. Fed hiking; slowing growth ahead.",
    coloring: "red",
    positioning: "Defensive positioning; favor quality and shorter duration.",
  },
  bull_flattening: {
    label: "Bull Flattening",
    mechanics: "All rates DOWN, long end falls MORE. Flight to safety; recession fears.",
    coloring: "blue",
    positioning: "Buy long-duration bonds; reduce cyclical risk.",
  },
  stable: {
    label: "Stable",
    mechanics: "Curve is stable — no significant directional move at the short/long pivot.",
    coloring: "muted",
    positioning: "Wait for a cleaner catalyst; size positions conservatively.",
  },
  mixed: {
    label: "Mixed",
    mechanics: "Short and long ends moving in different directions — no clean quadrant.",
    coloring: "muted",
    positioning: "Reduce conviction on curve trades; validate with macro data.",
  },
};

export function normalizeYieldCurvePattern(raw: string): YieldCurvePatternId {
  const k = raw.trim().toLowerCase();
  if (k in YIELD_CURVE_PATTERN_UI) return k as YieldCurvePatternId;
  return "mixed";
}
