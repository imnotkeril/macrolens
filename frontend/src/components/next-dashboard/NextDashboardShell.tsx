"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Grid2X2, RefreshCw, Settings, Sparkles, type LucideIcon } from "lucide-react";
import type { TaskProgress } from "@/types";

function sidebarRefreshHint(progress: TaskProgress | null) {
  if (!progress) return "Starting…";
  const last = progress.logs?.length ? progress.logs[progress.logs.length - 1]?.trim() : "";
  const detail = progress.message.trim() || last || progress.phase.trim();
  const pct = Math.max(0, Math.min(100, Math.round(Number.isFinite(progress.percent) ? progress.percent : 0)));
  return `${pct}%${detail ? ` · ${detail}` : ""}`;
}

export type SidebarNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  children?: Array<{ label: string; href: string }>;
};

type NextDashboardShellColors = {
  bg: string;
  sidebar: string;
  borderSoft: string;
  text: string;
  soft: string;
  muted: string;
  green: string;
  red: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
};

type NextDashboardShellProps = {
  navItems: SidebarNavItem[];
  colors: NextDashboardShellColors;
  shellThemeVars: CSSProperties;
  updatedAt: string;
  refreshing: boolean;
  refreshResult: "ok" | "error" | null;
  progress: TaskProgress | null;
  onRefresh: () => void;
  onThemeToggle: () => void;
  children: ReactNode;
};

export function NextDashboardShell({
  navItems,
  colors,
  shellThemeVars,
  updatedAt,
  refreshing,
  refreshResult,
  progress,
  onRefresh,
  onThemeToggle,
  children,
}: NextDashboardShellProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedNav, setExpandedNav] = useState<string | null>(null);

  useEffect(() => {
    const current = navItems.find(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`) ||
        item.children?.some((child) => pathname === child.href),
    );
    if (current?.children?.length) {
      setExpandedNav(current.label);
      return;
    }
    if (expandedNav && !navItems.some((item) => item.label === expandedNav && item.children?.length)) {
      setExpandedNav(null);
    }
  }, [pathname, expandedNav, navItems]);

  useEffect(() => {
    if (!frameRef.current) return;
    frameRef.current.scrollTo({ left: 0, top: 0 });
  }, []);

  return (
    <div
      ref={frameRef}
      className="fixed inset-0 z-[60] overflow-auto"
      style={{ ...shellThemeVars, background: colors.bg, color: colors.text, fontFamily: "var(--font-plex-mono), ui-monospace, monospace" }}
    >
      <div
        className="grid min-h-screen"
        style={{
          width: "100%",
          gridTemplateColumns: `${sidebarCollapsed ? 110 : 320}px minmax(0, 1fr)`,
        }}
      >
        <aside className="flex min-h-screen flex-col border-r px-[24px] py-[34px]" style={{ borderColor: colors.borderSoft, background: colors.sidebar }}>
          <div className={sidebarCollapsed ? "text-center" : undefined}>
            <div
              className="text-[34px] leading-none"
              style={{ letterSpacing: sidebarCollapsed ? "0.02em" : "0.23em" }}
            >
              {sidebarCollapsed ? "M" : "MACROLENS"}
            </div>
            {!sidebarCollapsed && (
              <div className="mt-[28px] flex gap-3">
                <span className="mt-1 h-3 w-3 rounded-full" style={{ background: colors.green }} />
                <div className="text-[13px] uppercase leading-[1.35] tracking-[0.08em]" style={{ color: colors.soft }}>
                  <div>Macro perspective.</div>
                  <div>Better decisions.</div>
                </div>
              </div>
            )}
          </div>

          <div className={`mt-[30px] space-y-[10px] ${sidebarCollapsed ? "" : "ml-[30px]"}`}>
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                item.children?.some((child) => pathname === child.href);
              const isExpanded = expandedNav === item.label;
              return (
                <div key={item.label}>
                  <Link
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className="flex h-[44px] w-full items-center gap-4 rounded-[2px] border px-3 text-left text-[13px] uppercase tracking-[0.06em]"
                    onClick={() => {
                      if (!item.children?.length) {
                        setExpandedNav(null);
                        return;
                      }
                      setExpandedNav((prev) => (prev === item.label ? null : item.label));
                    }}
                    style={{
                      marginTop: item.label === "Forecast Lab" ? 18 : undefined,
                      borderColor: isActive ? colors.activeBorder : "transparent",
                      background: isActive ? colors.activeBg : "transparent",
                      color: isActive ? colors.activeText : colors.soft,
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    }}
                  >
                    <Icon size={19} strokeWidth={isActive ? 2.8 : 2} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                  {!sidebarCollapsed && item.children?.length && isExpanded ? (
                    <div className="ml-9 mt-1.5 space-y-1 border-l pl-3 text-[10px] uppercase tracking-[0.09em]" style={{ borderColor: colors.borderSoft, color: colors.muted }}>
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block transition-opacity hover:opacity-90"
                          style={{ color: pathname === child.href ? colors.text : colors.muted }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className={`mt-auto ${sidebarCollapsed ? "" : "ml-[30px]"}`}>
            <div className="border-t pt-[22px]" style={{ borderColor: colors.borderSoft }}>
              {sidebarCollapsed ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={onRefresh}
                    title="Refresh data"
                    aria-busy={refreshing}
                    className="inline-flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50"
                    disabled={refreshing}
                  >
                    <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} style={{ color: refreshResult === "error" ? colors.red : refreshResult === "ok" ? colors.green : colors.soft }} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.08em]" style={{ color: colors.muted }}>Data as of</span>
                      <span className="truncate text-[12px] leading-none tabular-nums" style={{ color: colors.text }}>{updatedAt}</span>
                    </div>
                    <button
                      type="button"
                      onClick={onRefresh}
                      title="Refresh data"
                      aria-busy={refreshing}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50"
                      disabled={refreshing}
                    >
                      <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} style={{ color: refreshResult === "error" ? colors.red : refreshResult === "ok" ? colors.green : colors.soft }} />
                    </button>
                  </div>
                  {refreshing ? (
                    <div className="mt-[14px] min-w-0">
                      <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: colors.borderSoft }}>
                        <div
                          className="h-full rounded-full transition-[width] duration-300 ease-out"
                          style={{
                            width: `${Math.max(0, Math.min(100, Math.round(Number.isFinite(progress?.percent) ? (progress?.percent ?? 0) : 0)))}%`,
                            background: progress?.error ? colors.red : colors.green,
                          }}
                        />
                      </div>
                      <div
                        className="mt-2 truncate text-[10px] leading-tight tracking-[0.02em]"
                        style={{ color: colors.muted, fontVariantNumeric: "tabular-nums" }}
                        title={sidebarRefreshHint(progress)}
                      >
                        {sidebarRefreshHint(progress)}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <div className="mt-[28px] border-y py-[24px]" style={{ borderColor: colors.borderSoft }}>
              <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[22px]" style={{ background: colors.text, color: colors.bg }}>U</span>
                {!sidebarCollapsed && <div>
                  <div className="text-[13px] uppercase">User</div>
                  <div className="text-[12px]" style={{ color: colors.soft }}>Portfolio Manager</div>
                </div>}
              </div>
            </div>
            <div className={`mt-[24px] flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"}`} style={{ color: colors.soft }}>
              {!sidebarCollapsed && (
                <>
                  <button type="button" title="Toggle theme" onClick={onThemeToggle}>
                    <Sparkles size={20} />
                  </button>
                  <button type="button" title="Settings">
                    <Settings size={20} />
                  </button>
                  <button type="button" title="Notifications">
                    <Bell size={20} />
                  </button>
                </>
              )}
              <button type="button" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed((v) => !v)}>
                <Grid2X2 size={20} />
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0" style={{ padding: "14px 18px 20px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
