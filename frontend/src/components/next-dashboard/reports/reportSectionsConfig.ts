export const REPORT_SECTION_IDS = [
  "dashboard",
  "radar",
  "fed-policy",
  "yield-curve",
  "inflation",
  "analysis-relative-performance",
  "analysis-major-indices-bitcoin",
  "analysis-market-breadth",
  "analysis-macro-overview-1",
  "analysis-macro-overview-2",
] as const;

export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number];

export function isReportSectionId(value: string): value is ReportSectionId {
  return (REPORT_SECTION_IDS as readonly string[]).includes(value);
}

export type ReportSectionMeta = {
  id: ReportSectionId;
  title: string;
  description: string;
  href: string;
};

export const REPORT_SECTIONS: ReportSectionMeta[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Macro snapshot, navigator, allocations, and recommendations.",
    href: "/dashboard",
  },
  {
    id: "radar",
    title: "Radar",
    description: "Cycle score, recession probability, and regime timeline.",
    href: "/radar",
  },
  {
    id: "fed-policy",
    title: "Fed Policy",
    description: "Rate path, neutral gap, and policy stance visuals.",
    href: "/fed-policy",
  },
  {
    id: "yield-curve",
    title: "Yield Curve",
    description: "Curve shape, spreads, and dynamics.",
    href: "/yield-curve",
  },
  {
    id: "inflation",
    title: "Inflation",
    description: "Inflation breakdown and momentum panels.",
    href: "/inflation",
  },
  {
    id: "analysis-relative-performance",
    title: "Analysis — Relative performance",
    description: "Relative performance vs benchmarks.",
    href: "/analysis/relative-performance",
  },
  {
    id: "analysis-major-indices-bitcoin",
    title: "Analysis — Major indices & Bitcoin",
    description: "Indices and Bitcoin lens.",
    href: "/analysis/major-indices-bitcoin",
  },
  {
    id: "analysis-market-breadth",
    title: "Analysis — Market breadth",
    description: "Breadth and participation metrics.",
    href: "/analysis/market-breadth",
  },
  {
    id: "analysis-macro-overview-1",
    title: "Analysis — Macro overview (page 1)",
    description: "Factor tilts, rotation, commodities vs bonds (dual-axis charts).",
    href: "/analysis/macro-overview",
  },
  {
    id: "analysis-macro-overview-2",
    title: "Analysis — Macro overview (page 2)",
    description: "Rates, liquidity, leading indicators (single-series macro lines).",
    href: "/analysis/macro-overview",
  },
];

/** Accept legacy stored / URL ids after config changes. */
export function normalizeLegacyReportSectionId(raw: string): ReportSectionId | null {
  const trimmed = raw.trim();
  if (trimmed === "analysis") return "analysis-relative-performance";
  /** Older reports hub stored a single combined macro overview section */
  if (trimmed === "analysis-macro-overview") return "analysis-macro-overview-1";
  if (isReportSectionId(trimmed)) return trimmed;
  return null;
}
