"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Calendar,
  Flame,
  Grid3x3,
  Layers,
  LineChart,
  RefreshCw,
  Settings,
  Sparkles,
  Sun,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useDataRefresh } from "@/lib/useDataRefresh";

const PRIMARY_LINKS: {
  href: string;
  label: string;
  icon: typeof Activity;
  isActive?: (pathname: string) => boolean;
}[] = [
  { href: "/", label: "Trading Navigator", icon: Activity, isActive: (p) => p === "/" },
  { href: "/indicators", label: "Economic Indicators", icon: BarChart3 },
  { href: "/fed-policy", label: "Fed Policy", icon: TrendingDown },
  { href: "/analysis", label: "Yield Curve", icon: LineChart },
  { href: "/forecast-lab", label: "Recession Monitor", icon: Activity },
  { href: "/indicators", label: "Inflation", icon: Flame },
  { href: "/compare", label: "Recommendations", icon: Layers },
];

const SECONDARY_LINKS: { href: string; label: string; icon: typeof Sparkles }[] = [
  { href: "/forecast-lab", label: "ML Regime (Beta)", icon: Sparkles },
  { href: "/calendar", label: "Calendar & Alerts", icon: Calendar },
];

export function NavigatorTerminalChrome({
  children,
  dataAsOf,
  notificationCount = 3,
}: {
  children: React.ReactNode;
  dataAsOf?: string | null;
  notificationCount?: number;
}) {
  const pathname = usePathname();
  const { refreshing, progress, handleRefresh } = useDataRefresh();

  const asOfLabel = dataAsOf
    ? format(new Date(dataAsOf), "MMM d, yyyy")
    : "—";

  return (
    <div className="mx-auto flex h-[1080px] w-[1920px] min-w-[1920px] overflow-hidden bg-tn-canvas">
      <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-tn-border bg-tn-sidebar p-6">
        <div className="mb-8 px-1">
          <Link
            href="/"
            className="block font-sans text-xl font-semibold tracking-[0.15em] text-tn-cream"
          >
            MACROLENS
          </Link>
          <p className="mt-2 text-[11px] leading-snug text-tn-secondary">
            Macro perspective.
            <br />
            Better decisions.
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {PRIMARY_LINKS.map((item) => {
            const active = item.isActive
              ? item.isActive(pathname)
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium tracking-[0.05em] transition-colors",
                  active
                    ? "bg-tn-sidebarActive text-white"
                    : "text-tn-secondary hover:bg-tn-sidebarHover hover:text-tn-cream"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-tn-secondary")} strokeWidth={1.5} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="my-4 border-t border-tn-border pt-4">
            {SECONDARY_LINKS.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mb-0.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium tracking-[0.05em] transition-colors",
                    active
                      ? "bg-tn-sidebarActive text-white"
                      : "text-tn-secondary hover:bg-tn-sidebarHover hover:text-tn-cream"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-tn-secondary")} strokeWidth={1.5} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="mt-auto space-y-4 border-t border-tn-border pt-4">
          <div className="flex items-center justify-between px-1 font-mono text-[9px] text-tn-muted">
            <span>DATA AS OF {asOfLabel.toUpperCase()}</span>
            <div className="relative">
              <button
                type="button"
                title="Refresh pipeline"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="rounded p-1 text-tn-muted transition-colors hover:text-tn-cream disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} strokeWidth={1.5} />
              </button>
              {refreshing && progress ? (
                <div className="absolute bottom-full right-0 z-50 mb-1 w-36 rounded border border-tn-border bg-tn-panel px-2 py-1.5 text-[9px] shadow-lg">
                  <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-tn-positive transition-all"
                      style={{ width: `${Math.min(100, progress.percent)}%` }}
                    />
                  </div>
                  {progress.percent.toFixed(0)}% · {progress.phase || "…"}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-[10px] border border-tn-border bg-tn-card px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-tn-border bg-tn-canvas font-mono text-xs text-tn-cream">
              U
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium text-tn-cream">Portfolio Manager</div>
              <div className="text-[9px] text-tn-muted">Workspace</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 text-tn-muted">
            <button type="button" className="rounded p-1 hover:bg-white/[0.06] hover:text-tn-cream" aria-label="Theme">
              <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button type="button" className="rounded p-1 hover:bg-white/[0.06] hover:text-tn-cream" aria-label="Layout">
              <Grid3x3 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button type="button" className="relative rounded p-1 hover:bg-white/[0.06] hover:text-tn-cream" aria-label="Notifications">
              <Bell className="h-3.5 w-3.5" strokeWidth={1.5} />
              {notificationCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded bg-tn-negative px-0.5 text-[8px] font-mono text-white">
                  {notificationCount}
                </span>
              ) : null}
            </button>
            <button type="button" className="rounded p-1 hover:bg-white/[0.06] hover:text-tn-cream" aria-label="Settings">
              <Settings className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex h-full w-[1652px] min-w-[1652px] flex-col bg-tn-canvas">
        {children}
      </div>
    </div>
  );
}

export function NavigatorTerminalHeader({
  tab,
  onTabChange,
  lastUpdatedLabel,
}: {
  tab: "navigator" | "radar";
  onTabChange: (t: "navigator" | "radar") => void;
  lastUpdatedLabel: string;
}) {
  return (
    <header className="border-b border-tn-border px-8 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-sans text-[28px] font-semibold tracking-tight text-tn-cream">
            Trading Navigator
          </h1>
          <p className="mt-1 text-[13px] text-tn-secondary">Your macro regime in one view.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-tn-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tn-positive opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-tn-positive" />
              </span>
              Last updated {lastUpdatedLabel}
            </div>
            <div className="flex rounded-lg border border-tn-border bg-tn-card p-0.5 font-mono text-[12px]">
              <button
                type="button"
                onClick={() => onTabChange("navigator")}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  tab === "navigator" ? "bg-tn-sidebarActive text-white" : "text-tn-secondary hover:text-tn-cream"
                )}
              >
                Navigator
              </button>
              <button
                type="button"
                onClick={() => onTabChange("radar")}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  tab === "radar" ? "bg-tn-sidebarActive text-white" : "text-tn-secondary hover:text-tn-cream"
                )}
              >
                Radar
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="relative rounded-[10px] border border-tn-border bg-tn-card p-2 text-tn-secondary hover:text-tn-cream"
            aria-label="Alerts"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded bg-tn-negative px-1 text-[9px] font-mono text-white">
              3
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
