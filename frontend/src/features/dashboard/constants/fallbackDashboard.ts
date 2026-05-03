import { nextDashboardCssTokenColors as C } from "@/components/next-dashboard/nextDashboardConfig";

/** Used when API returns empty slices — snapshot modal and recommendations strip */

export const DASHBOARD_FALLBACK_FACTORS: Array<[string, string, string]> = [
  ["Growth", "OW", C.green],
  ["Value", "N", C.muted],
  ["Quality", "OW", C.green],
  ["Size", "N", C.muted],
  ["Beta", "UW", C.red],
  ["Cyclicals", "OW", C.green],
  ["Defensives", "UW", C.red],
];

export const DASHBOARD_FALLBACK_SECTORS: Array<[string, string, string]> = [
  ["Technology", "OW", C.green],
  ["Industrials", "OW", C.green],
  ["Financials", "N", C.soft],
  ["Energy", "N", C.soft],
  ["Consumer Discretionary", "OW", C.green],
  ["Consumer Staples", "UW", C.red],
];

export const DASHBOARD_FALLBACK_RECS = [
  { name: "Long XLY / Short XLP", trade_type: "Relative", legs: "LONG XLY   SHORT XLP" },
  { name: "Long IWM / Short SPY", trade_type: "Relative", legs: "LONG IWM   SHORT SPY" },
  { name: "Long EEM / Short EFA", trade_type: "Relative", legs: "LONG EEM   SHORT EFA" },
];

export const DASHBOARD_SECTOR_TICKER_MAP: Record<string, string> = {
  Technology: "XLK, VGT",
  Financials: "XLF, VFH",
  Energy: "XLE, VDE",
  Industrials: "XLI, VIS",
  Materials: "XLB, VAW",
  Healthcare: "XLV, VHT",
  Utilities: "XLU, VPU",
  "Consumer Discretionary": "XLY, VCR",
  "Consumer Staples": "XLP, VDC",
};
