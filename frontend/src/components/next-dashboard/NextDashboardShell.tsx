"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid2X2, Menu, RefreshCw, Sparkles, X, type LucideIcon } from "lucide-react";
import type { TaskProgress } from "@/types";
import { useOptionalReportStack } from "@/components/next-dashboard/nextReportStack";
import { formatDashboardAsOfLabel } from "@/features/dashboard/utils/dashboardAsOf";

/** One "Data as of" format for every screen: yyyy-MM-dd, or a short status word ("…", "No data"). */
function normalizeAsOf(raw: string): string {
  const t = raw.trim();
  if (!t) return "No data";
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return formatDashboardAsOfLabel(t);
  if (t === "—") return "No data";
  return t;
}

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
  /** Read-only snapshot layout: no refresh control, print-friendly root class */
  reportLayout?: boolean;
  /** Composite PDF: per-section @page height from measured content (preview route only) */
  variablePdfPages?: boolean;
};

export function NextDashboardShell({
  navItems,
  colors,
  shellThemeVars,
  updatedAt: updatedAtRaw,
  refreshing,
  refreshResult,
  progress,
  onRefresh,
  onThemeToggle,
  children,
  reportLayout = false,
  variablePdfPages = false,
}: NextDashboardShellProps) {
  const updatedAt = normalizeAsOf(updatedAtRaw);
  const reportStack = useOptionalReportStack();
  const embedded = reportStack?.embedded ?? false;
  const effectiveReportLayout = reportLayout || (reportStack?.reportLayout ?? false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const [sidebarCollapsedPref, setSidebarCollapsedPref] = useState(false);
  // Drawer is open only for the route it was opened on, so a route change closes it without an effect.
  const [drawerOpenPath, setDrawerOpenPath] = useState<string | null>(null);
  const drawerOpen = drawerOpenPath === pathname;
  const setDrawerOpen = (open: boolean) => setDrawerOpenPath(open ? pathname : null);
  const [isDesktop, setIsDesktop] = useState(true);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  // The rail only exists from lg; below lg the sidebar is an off-canvas drawer and always shows in full.
  const sidebarCollapsed = sidebarCollapsedPref && (isDesktop || effectiveReportLayout);
  const drawerMode = !effectiveReportLayout;
  const [expandedNav, setExpandedNav] = useState<string | null>(null);

  useEffect(() => {
    const current = navItems.find(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`) ||
        item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)),
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
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setDrawerOpen only wraps the state setter
  }, [drawerOpen]);

  useEffect(() => {
    if (!frameRef.current) return;
    frameRef.current.scrollTo({ left: 0, top: 0 });
  }, []);

  const pageTitle = (() => {
    const segments = pathname.split("/").filter(Boolean);
    for (const item of navItems) {
      const child = item.children?.find((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));
      if (child) return child.label;
    }
    const item = navItems.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
    if (!item) return "MacroLens";
    const itemDepth = item.href.split("/").filter(Boolean).length;
    if (segments.length > itemDepth) {
      const last = segments[segments.length - 1].replace(/-/g, " ");
      return `${item.label} - ${last.charAt(0).toUpperCase()}${last.slice(1)}`;
    }
    return item.label;
  })();
  // These screens render their own <h1>.
  const hasOwnH1 = pathname === "/reports" || pathname.startsWith("/calendar/briefings");

  const variablePdfClass = variablePdfPages && effectiveReportLayout ? " nd-report-shell--variable-pdf" : "";
  const outerClass = embedded
    ? `relative z-[1] min-h-screen w-full overflow-auto${effectiveReportLayout ? ` nd-report-shell${variablePdfClass}` : ""}`
    : `fixed inset-0 z-[60] overflow-auto${effectiveReportLayout ? ` nd-report-shell${variablePdfClass}` : ""}`;

  return (
    <div
      ref={frameRef}
      className={outerClass}
      style={{ ...shellThemeVars, background: colors.bg, color: colors.text, fontFamily: "var(--font-plex-mono), ui-monospace, monospace" }}
    >
      <div
        className={`nd-report-shell-inner-grid grid min-h-screen${
          drawerMode ? " grid-cols-1 lg:[grid-template-columns:var(--nd-sidebar-w)_minmax(0,1fr)]" : ""
        }`}
        style={{
          width: "100%",
          ["--nd-sidebar-w" as string]: `${sidebarCollapsed ? 110 : 320}px`,
          ...(drawerMode ? {} : { gridTemplateColumns: `${sidebarCollapsed ? 110 : 320}px minmax(0, 1fr)` }),
        }}
      >
        {drawerMode && (
          <header
            className="sticky top-0 z-[50] flex h-[52px] items-center gap-3 border-b px-3 lg:hidden"
            style={{ borderColor: colors.borderSoft, background: colors.sidebar }}
          >
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="nd-sidebar"
              onClick={() => setDrawerOpen(true)}
              className="nd-focus inline-flex h-10 w-10 items-center justify-center rounded-[2px]"
              style={{ color: colors.text }}
            >
              <Menu size={22} />
            </button>
            <span className="text-[18px] leading-none tracking-[0.2em]">MACROLENS</span>
          </header>
        )}
        {drawerMode && drawerOpen && (
          <div
            className="fixed inset-0 z-[68] bg-black/60 lg:hidden"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <aside
          id="nd-sidebar"
          className={`flex min-h-screen flex-col border-r px-[24px] py-[34px]${
            drawerMode
              ? ` fixed inset-y-0 left-0 z-[69] w-[min(320px,85vw)] overflow-y-auto transition-[transform,visibility] duration-200 lg:visible lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:overflow-visible lg:transition-none ${
                  drawerOpen ? "" : "invisible -translate-x-full"
                }`
              : ""
          }`}
          style={{ borderColor: colors.borderSoft, background: colors.sidebar }}
        >
          {drawerMode && (
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => {
                setDrawerOpen(false);
                menuButtonRef.current?.focus();
              }}
              className="nd-focus absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center lg:hidden"
              style={{ color: colors.soft }}
            >
              <X size={20} />
            </button>
          )}
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

          <nav aria-label="Primary" className={`mt-[30px] space-y-[10px] ${sidebarCollapsed ? "" : "ml-[30px]"}`}>
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`));
              const isExpanded = expandedNav === item.label;
              return (
                <div key={item.label}>
                  <Link
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={sidebarCollapsed ? item.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    className="nd-focus flex h-[44px] w-full items-center gap-4 rounded-[2px] border px-3 text-left text-[13px] uppercase tracking-[0.06em]"
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
                    <div className="ml-9 mt-1.5 space-y-1 border-l pl-3 text-[11px] uppercase tracking-[0.09em]" style={{ borderColor: colors.borderSoft, color: colors.muted }}>
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={pathname === child.href || pathname.startsWith(`${child.href}/`) ? "page" : undefined}
                          className="nd-focus block transition-opacity hover:opacity-90"
                          style={{
                            color:
                              pathname === child.href || pathname.startsWith(`${child.href}/`)
                                ? colors.text
                                : colors.muted,
                          }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className={`mt-auto ${sidebarCollapsed ? "" : "ml-[30px]"}`}>
            <div className="border-t pt-[22px]" style={{ borderColor: colors.borderSoft }}>
              {effectiveReportLayout ? (
                sidebarCollapsed ? (
                  <div className="flex justify-center print:hidden">
                    <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: colors.muted }} title="Snapshot">
                      Snap
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.08em]" style={{ color: colors.muted }}>
                        Report snapshot
                      </span>
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.08em]" style={{ color: colors.muted }}>
                          Data as of
                        </span>
                        <span className="truncate text-[12px] leading-none tabular-nums" style={{ color: colors.text }}>
                          {updatedAt}
                        </span>
                      </div>
                    </div>
                  </>
                )
              ) : sidebarCollapsed ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={onRefresh}
                    title="Refresh data"
                    aria-label="Refresh data"
                    aria-busy={refreshing}
                    className="nd-focus inline-flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50"
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
                      aria-label="Refresh data"
                      aria-busy={refreshing}
                      className="nd-focus inline-flex h-8 w-8 shrink-0 items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50"
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
                        className="mt-2 truncate text-[11px] leading-tight tracking-[0.02em]"
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
            <div className={`mt-[28px] flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"}`} style={{ color: colors.soft }}>
              {!sidebarCollapsed && (
                <>
                  <button type="button" className="nd-focus" title="Toggle theme" aria-label="Toggle theme" onClick={onThemeToggle}>
                    <Sparkles size={20} />
                  </button>
                </>
              )}
              <button type="button" className={`nd-focus${drawerMode ? " hidden lg:inline-flex" : ""}`} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsedPref((v) => !v)}>
                <Grid2X2 size={20} />
              </button>
            </div>
          </div>
        </aside>

        {/*
          Report preview stacks multiple tall sections; h-full locks main to the viewport and flex-shrink
          squashes each .nd-report-pdf-section into a fraction of the window. Use min-h-full so main grows
          with content (grid row expands); normal dashboard keeps h-full to fill the shell.
        */}
        <main
          className={
            effectiveReportLayout
              ? "flex min-h-full min-h-0 min-w-0 flex-col"
              : "flex h-full min-h-0 min-w-0 flex-col"
          }
          style={{ padding: "14px 18px 20px" }}
        >
          {hasOwnH1 ? null : <h1 className="sr-only">{pageTitle}</h1>}
          {children}
        </main>
      </div>
    </div>
  );
}
