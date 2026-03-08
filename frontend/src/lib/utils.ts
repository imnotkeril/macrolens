import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function trendColor(trend: string | null): string {
  switch (trend) {
    case "improving": return "text-accent-green";
    case "deteriorating": return "text-accent-red";
    default: return "text-accent-amber";
  }
}

export function trendArrow(trend: string | null): string {
  switch (trend) {
    case "improving": return "\u2197";
    case "deteriorating": return "\u2198";
    default: return "\u2192";
  }
}

export function scoreColor(score: number): string {
  if (score > 0.5) return "text-accent-green";
  if (score < -0.5) return "text-accent-red";
  return "text-accent-amber";
}

export function weightBadgeColor(weight: string): string {
  switch (weight) {
    case "overweight":
      return "bg-accent-green/10 text-accent-green border-accent-green/20";
    case "underweight":
      return "bg-accent-red/10 text-accent-red border-accent-red/20";
    default:
      return "bg-accent-amber/10 text-accent-amber border-accent-amber/20";
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "bg-accent-red/10 border-accent-red/20 text-accent-red";
    case "warning": return "bg-accent-amber/10 border-accent-amber/20 text-accent-amber";
    default: return "bg-accent-blue/10 border-accent-blue/20 text-accent-blue";
  }
}

export function formatNumber(value: number | null, decimals = 1): string {
  if (value === null || value === undefined) return "N/A";
  return value.toFixed(decimals);
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  housing: "Housing",
  orders: "Orders & Production",
  income_sales: "Income & Sales",
  employment: "Employment",
  inflation: "Inflation",
};
