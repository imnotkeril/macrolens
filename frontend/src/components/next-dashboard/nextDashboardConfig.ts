import type { CSSProperties } from "react";
import {
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
  { label: "Dashboard", icon: Grid2X2, href: "/dashboard" },
  { label: "Radar", icon: Gauge, href: "/radar" },
  { label: "Macro Sentiment", icon: LineChart, href: "/macro-sentiment" },
  { label: "Fed Policy", icon: CircleDollarSign, href: "/fed-policy" },
  { label: "Yield Curve", icon: TrendingUp, href: "/yield-curve" },
  { label: "Inflation", icon: Sparkles, href: "/inflation" },
  {
    label: "Analysis",
    icon: Compass,
    href: "/analysis",
    children: [
      { label: "Relative Performance", href: "/analysis/relative-performance" },
      { label: "Major Indices & Bitcoin", href: "/analysis/major-indices-bitcoin" },
      { label: "Market Breadth", href: "/analysis/market-breadth" },
      { label: "Macro Overview", href: "/analysis/macro-overview" },
    ],
  },
  { label: "Forecast Lab", icon: FlaskConical, href: "/forecast-lab" },
  { label: "Calendar", icon: CalendarDays, href: "/calendar" },
  { label: "Reports", icon: Package, href: "/reports" },
];
