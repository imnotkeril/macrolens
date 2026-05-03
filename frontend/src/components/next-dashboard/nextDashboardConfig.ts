import type { CSSProperties } from "react";
import {
  Activity,
  CalendarDays,
  CircleDollarSign,
  Compass,
  FlaskConical,
  Gauge,
  Grid2X2,
  LineChart,
  Package,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { SidebarNavItem } from "@/components/next-dashboard/NextDashboardShell";

/** Raw palette hex for building CSS vars (tokens). */

const DARK_THEME = {
  bg: "#070b10",
  sidebar: "#090d12",
  panel: "#10151b",
  panelSoft: "#0b1016",
  border: "#2f3842",
  borderSoft: "#232b33",
  text: "#d7d0c7",
  soft: "#b1ada6",
  muted: "#7e7e78",
  green: "#72ad66",
  red: "#d45d72",
  yellow: "#d4a93b",
  blue: "#5d82be",
  purple: "#8b65aa",
  orange: "#b87856",
  activeBg: "#d1ccc1",
  activeBorder: "#ccc7be",
  activeText: "#0b0d0f",
};

const LIGHT_THEME = {
  bg: "#ece8dd",
  sidebar: "#ddd7c9",
  panel: "#f5f2e8",
  panelSoft: "#ebe6d8",
  border: "#7b746b",
  borderSoft: "#9a9388",
  text: "#232019",
  soft: "#3d382f",
  muted: "#666055",
  green: "#2f7c3f",
  red: "#b84952",
  yellow: "#a97c22",
  blue: "#45699f",
  purple: "#705193",
  orange: "#9e623f",
  activeBg: "#f7f4ec",
  activeBorder: "#1e1b14",
  activeText: "#11100b",
};

export type NextDashboardThemeMode = "dark" | "light";

export function nextDashboardCssVars(mode: NextDashboardThemeMode): CSSProperties {
  const palette = mode === "dark" ? DARK_THEME : LIGHT_THEME;
  return {
    "--nd-bg": palette.bg,
    "--nd-sidebar": palette.sidebar,
    "--nd-panel": palette.panel,
    "--nd-panel-soft": palette.panelSoft,
    "--nd-border": palette.border,
    "--nd-border-soft": palette.borderSoft,
    "--nd-text": palette.text,
    "--nd-soft": palette.soft,
    "--nd-muted": palette.muted,
    "--nd-green": palette.green,
    "--nd-red": palette.red,
    "--nd-yellow": palette.yellow,
    "--nd-blue": palette.blue,
    "--nd-purple": palette.purple,
    "--nd-orange": palette.orange,
    "--nd-active-bg": palette.activeBg,
    "--nd-active-border": palette.activeBorder,
    "--nd-active-text": palette.activeText,
  } as CSSProperties;
}

/** Token references consumed by dashboard panels (Tailwind-independent). */

export const nextDashboardCssTokenColors = {
  bg: "var(--nd-bg)",
  sidebar: "var(--nd-sidebar)",
  panel: "var(--nd-panel)",
  panelSoft: "var(--nd-panel-soft)",
  border: "var(--nd-border)",
  borderSoft: "var(--nd-border-soft)",
  text: "var(--nd-text)",
  soft: "var(--nd-soft)",
  muted: "var(--nd-muted)",
  green: "var(--nd-green)",
  red: "var(--nd-red)",
  yellow: "var(--nd-yellow)",
  blue: "var(--nd-blue)",
  purple: "var(--nd-purple)",
  orange: "var(--nd-orange)",
  activeBg: "var(--nd-active-bg)",
  activeBorder: "var(--nd-active-border)",
  activeText: "var(--nd-active-text)",
} as const;

export const NEXT_DASHBOARD_NAV_ITEMS: SidebarNavItem[] = [
  { label: "Dashboard", icon: Grid2X2, href: "/next/dashboard" },
  { label: "Radar", icon: Gauge, href: "/next/radar" },
  {
    label: "Macro Sentiment",
    icon: LineChart,
    href: "/next/macro-sentiment",
    children: [
      { label: "Housing", href: "/next/macro-sentiment/housing" },
      { label: "Orders & Production", href: "/next/macro-sentiment/orders-production" },
      { label: "Income & Sales", href: "/next/macro-sentiment/income-sales" },
      { label: "Employment", href: "/next/macro-sentiment/employment" },
      { label: "Inflation", href: "/next/macro-sentiment/inflation" },
    ],
  },
  { label: "Fed Policy", icon: CircleDollarSign, href: "/next/fed-policy" },
  { label: "Yield Curve", icon: TrendingUp, href: "/next/yield-curve" },
  { label: "Recession Monitor", icon: Activity, href: "/next/recession-monitor" },
  {
    label: "Inflation",
    icon: Sparkles,
    href: "/next/inflation",
    children: [
      { label: "CPI", href: "/next/inflation/cpi" },
      { label: "PCE", href: "/next/inflation/pce" },
      { label: "PPI", href: "/next/inflation/ppi" },
    ],
  },
  {
    label: "Analysis",
    icon: Compass,
    href: "/next/analysis",
    children: [
      { label: "Major Indices & Bitcoin", href: "/next/analysis/major-indices-bitcoin" },
      { label: "Sectors & Sentiment", href: "/next/analysis/sectors-sentiment" },
      { label: "Market Breadth", href: "/next/analysis/market-breadth" },
      { label: "Macro Overview", href: "/next/analysis/macro-overview" },
      { label: "Commodities & Global Activity", href: "/next/analysis/commodities-global-activity" },
      { label: "Risk Appetite & Relative Performance", href: "/next/analysis/risk-appetite-relative-performance" },
    ],
  },
  { label: "Forecast Lab", icon: FlaskConical, href: "/next/forecast-lab" },
  { label: "Calendar & Alerts", icon: CalendarDays, href: "/next/calendar-alerts" },
  { label: "Reports", icon: Package, href: "/next/reports" },
];
