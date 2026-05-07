import type { IndicatorCategory } from "@/types";

export const CATEGORY_PHASE: Record<IndicatorCategory, string> = {
  housing: "Leading",
  orders: "Leading",
  income_sales: "Coincident",
  employment: "Lagging",
  inflation: "Coincident",
};

export const SLUG_TO_CATEGORY: Record<string, IndicatorCategory> = {
  housing: "housing",
  "orders-production": "orders",
  orders: "orders",
  "income-sales": "income_sales",
  employment: "employment",
  inflation: "inflation",
};

/** Categories used for top KPI strip (four sector scores + composite). */
export const KPI_SCORE_CATEGORIES: IndicatorCategory[] = ["housing", "orders", "income_sales", "employment"];

export const SIDEBAR: { slug: string; label: string; note?: string }[] = [
  { slug: "housing", label: "Housing" },
  { slug: "orders-production", label: "Orders & Production" },
  { slug: "income-sales", label: "Income & Sales" },
  { slug: "employment", label: "Employment" },
  { slug: "inflation", label: "Inflation" },
];

/** Table body scroll — ~5 rows + header; aligns with sidebar column height on xl. */
export const TABLE_SCROLL_MAX_PX = 392;

/** Max width for the indicator name column, capped around "Case-Shiller Home Price Index". */
export const MACRO_INDICATOR_NAME_MAX_PX = 244;

/** MoM / YoY: minimal equal width; tabular % fits in one line. */
export const MACRO_PCT_COL_WIDTH_REM = "3.5rem";

export const CHART_PERIODS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "ALL", months: 0 },
] as const;

/** Rolling window length (monthly → ~2 years of history). */
export const Z_ROLLING_WINDOW = 24;

/** ±2σ band for rolling-z reference guides. */
export const Z_SCORE_BAND = 2;
