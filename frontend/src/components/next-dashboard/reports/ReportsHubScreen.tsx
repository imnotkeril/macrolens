"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Printer } from "lucide-react";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import {
  REPORT_SECTIONS,
  normalizeLegacyReportSectionId,
  type ReportSectionId,
} from "@/components/next-dashboard/reports/reportSectionsConfig";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { useDataRefresh } from "@/lib/useDataRefresh";

const STORAGE_KEY = "macrolens-report-sections-v1";

function loadSelection(): Set<ReportSectionId> {
  const fallback = new Set<ReportSectionId>(["dashboard"]);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const next = new Set<ReportSectionId>();
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const id = normalizeLegacyReportSectionId(item);
      if (id) next.add(id);
    }
    return next.size ? next : fallback;
  } catch {
    return fallback;
  }
}

export function ReportsHubScreen() {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const [updatedAt, setUpdatedAt] = useState("—");
  const [selected, setSelected] = useState<Set<ReportSectionId>>(() => loadSelection());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUpdatedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    setMounted(true);
    setSelected(loadSelection());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected)));
  }, [mounted, selected]);

  const toggle = useCallback((id: ReportSectionId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return next;
        next.delete(id);
        return next;
      }
      next.add(id);
      return next;
    });
  }, []);

  const previewHref = useMemo(() => {
    const order = REPORT_SECTIONS.map((s) => s.id).filter((id) => selected.has(id));
    const q = encodeURIComponent(order.join(","));
    return `/reports/preview?sections=${q}`;
  }, [selected]);

  return (
    <NextDashboardShell
      navItems={NEXT_DASHBOARD_NAV_ITEMS}
      colors={C}
      shellThemeVars={shellThemeVars}
      updatedAt={updatedAt}
      refreshing={refreshing}
      refreshResult={refreshResult}
      progress={progress}
      onRefresh={handleRefresh}
      onThemeToggle={toggleTheme}
    >
      <section className="flex min-h-0 flex-1 flex-col gap-4" style={{ color: C.text }}>
        <header className="min-w-0">
          <h1 className="text-[18px] font-medium uppercase tracking-[0.08em]">Reports</h1>
          <p className="mt-2 max-w-[720px] text-[12px] leading-relaxed" style={{ color: C.soft }}>
            Choose sections for the printable PDF. Your selection is saved in this browser. Use Preview &amp; print, then print or save as PDF
            (same layout rules as the Dashboard report — no forced page splits between sections).
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={previewHref}
            className="inline-flex items-center gap-2 rounded-[2px] border px-4 py-2.5 text-[11px] uppercase tracking-[0.08em] transition-opacity hover:opacity-90"
            style={{
              borderColor: C.activeBorder,
              background: C.activeBg,
              color: C.activeText,
            }}
          >
            <Printer size={15} strokeWidth={2.2} aria-hidden />
            Preview &amp; print
          </Link>
          <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: C.muted }}>
            {selected.size} section{selected.size === 1 ? "" : "s"} selected
          </span>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {REPORT_SECTIONS.map((section) => {
            const checked = selected.has(section.id);
            return (
              <li
                key={section.id}
                className="flex gap-3 rounded-[2px] border p-3 transition-opacity hover:opacity-[0.98]"
                style={{
                  borderColor: C.borderSoft,
                  background: C.panel,
                }}
              >
                <label className="flex flex-1 cursor-pointer gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--nd-green)]"
                    checked={checked}
                    onChange={() => toggle(section.id)}
                    aria-label={`Include ${section.title} in report`}
                  />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium uppercase tracking-[0.06em] leading-snug">
                      {section.title}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug" style={{ color: C.soft }}>
                      {section.description}
                    </span>
                  </span>
                </label>
                <Link
                  href={section.href}
                  title={`Open ${section.title}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] border transition-opacity hover:opacity-90"
                  style={{ borderColor: C.borderSoft, color: C.muted }}
                >
                  <ExternalLink size={15} strokeWidth={2} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </NextDashboardShell>
  );
}
