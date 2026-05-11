"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { ReportStackProvider } from "@/components/next-dashboard/nextReportStack";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { NextDashboardScreen } from "@/components/next-dashboard/NextDashboardScreen";
import { NextRadarScreen } from "@/components/next-dashboard/NextRadarScreen";
import { NextFedPolicyScreen } from "@/components/next-dashboard/fed-policy/NextFedPolicyScreen";
import { NextYieldCurveScreen } from "@/components/next-dashboard/yield-curve/NextYieldCurveScreen";
import { NextInflationScreen } from "@/components/next-dashboard/inflation/NextInflationScreen";
import { NextRelativePerformanceScreen } from "@/components/next-dashboard/analysis/NextRelativePerformanceScreen";
import { NextMajorIndicesScreen } from "@/components/next-dashboard/analysis/NextMajorIndicesScreen";
import { NextMarketBreadthScreen } from "@/components/next-dashboard/analysis/NextMarketBreadthScreen";
import { NextMacroRatiosScreen } from "@/components/next-dashboard/analysis/NextMacroRatiosScreen";
import {
  normalizeLegacyReportSectionId,
  type ReportSectionId,
} from "@/components/next-dashboard/reports/reportSectionsConfig";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { useDataRefresh } from "@/lib/useDataRefresh";
import { useVariablePdfSectionPages } from "@/components/next-dashboard/reports/useVariablePdfSectionPages";

function parseSectionOrder(raw: string | null): ReportSectionId[] {
  if (!raw?.trim()) return ["dashboard"];
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const seen = new Set<ReportSectionId>();
  const out: ReportSectionId[] = [];
  for (const p of parts) {
    const id = normalizeLegacyReportSectionId(p);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length ? out : ["dashboard"];
}

function ReportSectionFrame({ id }: { id: ReportSectionId }) {
  switch (id) {
    case "dashboard":
      return <NextDashboardScreen mode="report" omitShell />;
    case "radar":
      return <NextRadarScreen omitShell />;
    case "fed-policy":
      return <NextFedPolicyScreen omitShell />;
    case "yield-curve":
      return <NextYieldCurveScreen omitShell />;
    case "inflation":
      return <NextInflationScreen omitShell />;
    case "analysis-relative-performance":
      return <NextRelativePerformanceScreen omitShell />;
    case "analysis-major-indices-bitcoin":
      return <NextMajorIndicesScreen omitShell />;
    case "analysis-market-breadth":
      return <NextMarketBreadthScreen omitShell />;
    case "analysis-macro-overview-1":
      return <NextMacroRatiosScreen omitShell macroOverviewPage={1} />;
    case "analysis-macro-overview-2":
      return <NextMacroRatiosScreen omitShell macroOverviewPage={2} />;
    default:
      return null;
  }
}

export function ReportsPreviewContent() {
  const searchParams = useSearchParams();
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const [updatedAt, setUpdatedAt] = useState("—");

  useEffect(() => {
    setUpdatedAt(new Date().toISOString());
  }, []);

  useVariablePdfSectionPages(true);

  const sections = useMemo(
    () => parseSectionOrder(searchParams.get("sections")),
    [searchParams],
  );

  return (
    <ReportStackProvider value={{ embedded: false, reportLayout: false, compositePreview: true }}>
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
        reportLayout
        variablePdfPages
      >
        <div
          className="print:hidden shrink-0"
          style={{
            marginBottom: 12,
            borderRadius: 2,
            border: `1px solid ${C.borderSoft}`,
            background: C.panelSoft,
            color: C.text,
            padding: "12px 14px",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                Report preview
              </div>
              <div className="mt-1 text-[11px] leading-snug" style={{ color: C.soft }}>
                Sections: {sections.join(", ")} — each section maps to its own PDF page; <strong>page height adapts to content</strong> when you print (unusually tall sections may still split across sheets). Print at <strong>100%</strong> with{" "}
                <strong>background graphics</strong>. In Chrome / Edge disable <strong>Headers and footers</strong> under More settings. Margins: <strong>None</strong> / minimum.
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link
                href="/reports"
                className="rounded-[2px] border px-3 py-2 text-[11px] uppercase tracking-[0.06em] transition-opacity hover:opacity-90"
                style={{ borderColor: C.borderSoft, color: C.soft }}
              >
                Back
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-[2px] border px-3 py-2 text-[11px] uppercase tracking-[0.06em] transition-opacity hover:opacity-90"
                style={{
                  borderColor: C.activeBorder,
                  background: C.activeBg,
                  color: C.activeText,
                }}
                onClick={() => window.print()}
              >
                <Printer size={15} strokeWidth={2.2} aria-hidden />
                Print / PDF
              </button>
            </div>
          </div>
        </div>

        <div className="nd-report-pdf-sections flex shrink-0 flex-col gap-10 print:gap-0">
          {sections.map((id, sectionIndex) => (
            <div
              key={id}
              className="nd-report-pdf-section shrink-0"
              data-section-index={sectionIndex}
              data-section-id={id}
            >
              <ReportSectionFrame id={id} />
            </div>
          ))}
        </div>
      </NextDashboardShell>
    </ReportStackProvider>
  );
}
