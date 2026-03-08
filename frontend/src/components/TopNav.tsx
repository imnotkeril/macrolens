"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { refreshAllData, getRefreshProgress } from "@/lib/api";
import type { TaskProgress } from "@/types";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/predictive", label: "Predictive" },
  { href: "/ml-regime", label: "ML Regime" },
  { href: "/analysis", label: "Analysis" },
  { href: "/indicators", label: "Indicators" },
  { href: "/calendar", label: "Calendar" },
  { href: "/reports", label: "Reports" },
];

const REFRESH_POLL_MS = 1500;

export function TopNav() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<"ok" | "error" | null>(null);
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const refreshDoneRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshResult(null);
    setProgress(null);
    refreshDoneRef.current = false;
    try {
      const result = await refreshAllData();
      refreshDoneRef.current = true;
      setRefreshResult(result.errors.length === 0 ? "ok" : "error");
    } catch {
      refreshDoneRef.current = true;
      setRefreshResult("error");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshResult(null), 4000);
    }
  }, [refreshing]);

  useEffect(() => {
    if (!refreshing) return;
    const t = setInterval(async () => {
      if (refreshDoneRef.current) return;
      try {
        const p = await getRefreshProgress();
        setProgress(p);
        if (p.done) refreshDoneRef.current = true;
      } catch {
        /* ignore poll errors */
      }
    }, REFRESH_POLL_MS);
    return () => clearInterval(t);
  }, [refreshing]);

  return (
    <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl bg-bg/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-light tracking-[0.2em] text-text-primary">
          MACROLENS
        </Link>

        <nav className="flex items-center gap-5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "nav-link",
                (item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)) && "nav-link-active"
              )}
            >
              {item.label}
            </Link>
          ))}

          <div className="relative ml-2 flex items-center">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh all data from FRED & Yahoo (may take 5–15 min)"
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-light transition-all duration-200",
                refreshing
                  ? "border-accent/30 text-accent cursor-wait"
                  : refreshResult === "ok"
                    ? "border-accent-green/30 text-accent-green"
                    : refreshResult === "error"
                      ? "border-accent-red/30 text-accent-red"
                      : "border-border text-text-muted hover:text-text-secondary hover:border-text-muted"
              )}
            >
              <svg
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              {refreshing ? "Updating… (5–15 min)" : refreshResult === "ok" ? "Done" : refreshResult === "error" ? "Error" : "Refresh"}
            </button>
            {refreshing && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded border border-border bg-bg-card px-2 py-1.5 shadow-lg">
                {progress ? (
                  <>
                    <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-accent transition-all duration-300"
                        style={{ width: `${Math.min(100, progress.percent)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-text-muted">{progress.percent.toFixed(0)}% · {progress.phase || "…"}</p>
                    {(progress.logs ?? []).length > 0 ? (
                      <div className="mt-1 max-h-20 overflow-y-auto text-[10px] text-text-secondary font-mono">
                        {(progress.logs ?? []).slice(-4).map((line, i) => (
                          <div key={i} className="truncate">{line}</div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-[10px] text-text-muted">0% · Starting…</p>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
