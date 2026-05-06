/** Canonical tenor order for snapshot X-axis (matches backend `MATURITY_ORDER`). */
export const YIELD_SNAPSHOT_TENORS = [
  "3M",
  "1Y",
  "2Y",
  "3Y",
  "5Y",
  "7Y",
  "10Y",
  "20Y",
  "30Y",
] as const;

export type YieldSnapshotTenor = (typeof YIELD_SNAPSHOT_TENORS)[number];

/** Snapshot line styling — Now vs historical offsets (backend history order: 3m, 6m, 1y). */
export const SNAPSHOT_SERIES = [
  { key: "now", label: "Now", dashed: false },
  { key: "ago3m", label: "3M ago", dashed: true, tone: "light" as const },
  { key: "ago6m", label: "6M ago", dashed: true, tone: "mid" as const },
  { key: "ago1y", label: "1Y ago", dashed: true, tone: "dark" as const },
] as const;
