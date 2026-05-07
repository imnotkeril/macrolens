"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { QueryErrorBanner } from "@/components/next-dashboard/QueryErrorBanner";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useDataRefresh } from "@/lib/useDataRefresh";
import { getInflationDashboard } from "@/lib/api";
import { InflationDualChartCard } from "./InflationDualChartCard";
import { InflationComponentsCard } from "./InflationComponentsCard";
import { NEXT_INFLATION_QUERY_ROOT } from "./inflationQueryKeys";
import {
  alignSpreadSeries,
  latestDateAcrossSeries,
  pickPastValue,
  sortSeries,
} from "./inflationUtils";
import { YieldCurveStripLineCard } from "@/components/next-dashboard/yield-curve/YieldCurveStripLineCard";

export function NextInflationScreen() {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const queryClient = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();

  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const panel = useMemo(() => ({ ...surface, padding: "12px 22px" } as const), [surface]);
  const ROW1_CARD_H = "h-[452px]";
  const ROW_CHART_H = 268;
  const rowCardShell = "flex min-h-[360px] flex-col";

  const inflQ = useQuery({
    queryKey: [NEXT_INFLATION_QUERY_ROOT, "dashboard"],
    queryFn: () => getInflationDashboard(365 * 6),
    staleTime: 120_000,
  });

  const updatedAt = useMemo(
    () =>
      latestDateAcrossSeries([
        inflQ.data?.cpi_yoy,
        inflQ.data?.pce_yoy,
        inflQ.data?.ppi_yoy,
        inflQ.data?.sticky_cpi,
        inflQ.data?.mich,
        inflQ.data?.t5yie,
        inflQ.data?.t10yie,
      ]),
    [inflQ.data],
  );

  const stickyVsHeadline = useMemo(
    () => alignSpreadSeries(inflQ.data?.sticky_cpi, inflQ.data?.cpi_yoy),
    [inflQ.data?.sticky_cpi, inflQ.data?.cpi_yoy],
  );
  const breakevenGap = useMemo(
    () => alignSpreadSeries(inflQ.data?.t10yie, inflQ.data?.t5yie),
    [inflQ.data?.t10yie, inflQ.data?.t5yie],
  );
  const realPolicyRate = useMemo(
    () => alignSpreadSeries(inflQ.data?.effr, inflQ.data?.pce_core_yoy),
    [inflQ.data?.effr, inflQ.data?.pce_core_yoy],
  );

  const summaryRows = useMemo(() => {
    const rows = [
      { label: "CPI YoY", series: inflQ.data?.cpi_yoy },
      { label: "PCE YoY", series: inflQ.data?.pce_yoy },
      { label: "PPI YoY", series: inflQ.data?.ppi_yoy },
      { label: "Core CPI YoY", series: inflQ.data?.cpi_core_yoy },
      { label: "Core PCE YoY", series: inflQ.data?.pce_core_yoy },
      { label: "Core PPI YoY", series: inflQ.data?.ppi_core_yoy },
    ];
    return rows
      .map((row) => {
        const series = sortSeries(row.series);
        if (!series.length) return null;
        const now = series[series.length - 1].value;
        const m3 = pickPastValue(series, 3);
        const m6 = pickPastValue(series, 6);
        const y1 = pickPastValue(series, 12);
        return {
          label: row.label,
          now,
          d3: m3 == null ? null : now - m3,
          d6: m6 == null ? null : now - m6,
          d12: y1 == null ? null : now - y1,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [inflQ.data]);

  const headlineRows = useMemo(() => summaryRows.slice(0, 3), [summaryRows]);
  const coreRows = useMemo(() => summaryRows.slice(3, 6), [summaryRows]);

  const headlineHeatScale = useMemo(() => {
    const vals = headlineRows.flatMap((r) => [r.d3, r.d6, r.d12]).filter((v): v is number => v != null && Number.isFinite(v));
    const maxAbs = vals.length ? Math.max(...vals.map((v) => Math.abs(v))) : 1;
    return Math.max(0.25, maxAbs);
  }, [headlineRows]);

  const coreHeatScale = useMemo(() => {
    const vals = coreRows.flatMap((r) => [r.d3, r.d6, r.d12]).filter((v): v is number => v != null && Number.isFinite(v));
    const maxAbs = vals.length ? Math.max(...vals.map((v) => Math.abs(v))) : 1;
    return Math.max(0.25, maxAbs);
  }, [coreRows]);

  const errors = useMemo(() => {
    if (!inflQ.isError) return [];
    return [{ label: "Inflation dashboard", message: String(inflQ.error) }];
  }, [inflQ.isError, inflQ.error]);

  const onRetry = () => void queryClient.invalidateQueries({ queryKey: [NEXT_INFLATION_QUERY_ROOT] });

  const matrixCellStyle = (v: number | null, scale: number) => {
    if (v == null || !Number.isFinite(v)) {
      return {
        background: "rgba(126,126,120,0.15)",
        color: "var(--nd-muted)",
      };
    }
    const intensity = Math.min(1, Math.abs(v) / scale);
    const alpha = 0.18 + intensity * 0.42;
    if (v >= 0) {
      return {
        background: `rgba(212,93,114,${alpha.toFixed(3)})`,
        color: "#ffd6dc",
      };
    }
    return {
      background: `rgba(114,173,102,${alpha.toFixed(3)})`,
      color: "#d6f1d1",
    };
  };

  const summarySignal = useMemo(() => {
    const avg = (rows: typeof summaryRows) => {
      const vals = rows.flatMap((r) => [r.d3, r.d6, r.d12]).filter((v): v is number => v != null && Number.isFinite(v));
      if (!vals.length) return 0;
      return vals.reduce((acc, v) => acc + v, 0) / vals.length;
    };
    const h = avg(headlineRows);
    const c = avg(coreRows);
    const combo = h * 0.55 + c * 0.45;
    const regime = combo > 0.18 ? "Inflation Accelerating" : combo < -0.18 ? "Inflation Cooling" : "Inflation Mixed";
    const strength = Math.min(1, Math.abs(combo) / 1.2);
    return { headline: h, core: c, combo, regime, strength };
  }, [headlineRows, coreRows]);

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
      <section className="flex flex-col gap-2">
        <QueryErrorBanner colors={C} errors={errors} onRetry={onRetry} />

        <div className="grid grid-cols-1 gap-2 xl:grid-cols-3 xl:items-stretch">
          <div className={`${ROW1_CARD_H} min-w-0 overflow-hidden`} style={panel}>
            <InflationDualChartCard
              title="CPI"
              yoyPrimary={{ name: "CPI YoY", rows: inflQ.data?.cpi_yoy, color: String(C.green) }}
              yoySecondary={{ name: "Core CPI YoY", rows: inflQ.data?.cpi_core_yoy, color: String(C.purple) }}
              mom={{ name: "CPI MoM", rows: inflQ.data?.cpi_mom }}
              spxRows={inflQ.data?.spx}
              pending={inflQ.isPending}
            />
          </div>
          <div className={`${ROW1_CARD_H} min-w-0 overflow-hidden`} style={panel}>
            <InflationDualChartCard
              title="PCE"
              yoyPrimary={{ name: "PCE YoY", rows: inflQ.data?.pce_yoy, color: String(C.green) }}
              yoySecondary={{ name: "Core PCE YoY", rows: inflQ.data?.pce_core_yoy, color: String(C.purple) }}
              mom={{ name: "PCE MoM", rows: inflQ.data?.pce_mom }}
              spxRows={inflQ.data?.spx}
              pending={inflQ.isPending}
            />
          </div>
          <div className={`${ROW1_CARD_H} min-w-0 overflow-hidden`} style={panel}>
            <InflationDualChartCard
              title="PPI"
              yoyPrimary={{ name: "PPI YoY", rows: inflQ.data?.ppi_yoy, color: String(C.green) }}
              yoySecondary={{ name: "Core PPI YoY", rows: inflQ.data?.ppi_core_yoy, color: String(C.purple) }}
              mom={{ name: "PPI MoM", rows: inflQ.data?.ppi_mom }}
              spxRows={inflQ.data?.spx}
              pending={inflQ.isPending}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
          <div className={`${rowCardShell} min-w-0`} style={panel}>
            <YieldCurveStripLineCard
              title="STICKY VS HEADLINE"
              subtitle="Sticky CPI - CPI YoY"
              rows={stickyVsHeadline}
              lineColor={String(C.red)}
              pending={inflQ.isPending}
              height={ROW_CHART_H}
              yTickFormat={(v) => `${v.toFixed(1)}%`}
              tooltipFormat={(v) => `${v.toFixed(2)}%`}
              referenceLines={[{ y: 2, label: "Fed target" }]}
              initialPeriod="ALL"
            />
          </div>
          <div className={`${rowCardShell} min-w-0`} style={panel}>
            <YieldCurveStripLineCard
              title="5Y INFLATION EXP."
              subtitle="survey in Michigan"
              rows={inflQ.data?.mich}
              lineColor={String(C.yellow)}
              pending={inflQ.isPending}
              height={ROW_CHART_H}
              yTickFormat={(v) => `${v.toFixed(1)}%`}
              tooltipFormat={(v) => `${v.toFixed(2)}%`}
              referenceLines={[{ y: 2, label: "Fed target" }]}
              initialPeriod="ALL"
            />
          </div>
          <div className={`${rowCardShell} min-w-0`} style={panel}>
            <YieldCurveStripLineCard
              title="BREAKEVEN GAP"
              subtitle="10Y BE - 5Y BE"
              rows={breakevenGap}
              lineColor={String(C.orange)}
              pending={inflQ.isPending}
              height={ROW_CHART_H}
              yTickFormat={(v) => `${v.toFixed(1)}%`}
              tooltipFormat={(v) => `${v.toFixed(2)}%`}
              referenceLines={[{ y: 0, label: "Zero" }]}
              initialPeriod="ALL"
            />
          </div>
          <div className={`${rowCardShell} min-w-0`} style={panel}>
            <YieldCurveStripLineCard
              title="REAL POLICY RATE"
              subtitle="EFFR - Core PCE YoY"
              rows={realPolicyRate}
              lineColor="#d96fb0"
              pending={inflQ.isPending}
              height={ROW_CHART_H}
              yTickFormat={(v) => `${v.toFixed(1)}%`}
              tooltipFormat={(v) => `${v.toFixed(2)}%`}
              referenceLines={[{ y: 0, label: "Zero" }]}
              initialPeriod="ALL"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 xl:grid-cols-4 xl:items-stretch">
          <div className={`${rowCardShell} min-w-0 xl:col-span-3`} style={panel}>
            <InflationComponentsCard
              cpiYoy={inflQ.data?.cpi_yoy}
              cpiCoreYoy={inflQ.data?.cpi_core_yoy}
              pending={inflQ.isPending}
            />
          </div>
          <div className={`${rowCardShell} min-w-0 xl:col-span-1`} style={panel}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-text)" }}>
                Now vs History
              </div>
              <div className="mt-2 flex min-h-0 flex-1 flex-col items-center justify-center">
                <table className="w-full max-w-[430px] border-separate border-spacing-y-px text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
                      <th className="pb-1 text-center font-medium">Series</th>
                      <th className="pb-1 text-center font-medium">Now</th>
                      <th className="pb-1 text-center font-medium">3M</th>
                      <th className="pb-1 text-center font-medium">6M</th>
                      <th className="pb-1 text-center font-medium">1Y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headlineRows.map((r) => (
                      <tr key={r.label}>
                        <td className="py-0.5 pr-1.5 text-center" style={{ color: "var(--nd-soft)" }}>{r.label}</td>
                        <td className="py-0.5 text-center tabular-nums" style={{ color: "var(--nd-text)" }}>
                          {r.now.toFixed(2)}%
                        </td>
                        <td className="py-0.5 pl-1">
                          <div className="rounded-[2px] px-1.5 py-0.5 text-center font-mono tabular-nums" style={matrixCellStyle(r.d3, headlineHeatScale)}>
                            {r.d3 == null ? "—" : `${r.d3 >= 0 ? "+" : ""}${r.d3.toFixed(2)}`}
                          </div>
                        </td>
                        <td className="py-0.5 pl-1">
                          <div className="rounded-[2px] px-1.5 py-0.5 text-center font-mono tabular-nums" style={matrixCellStyle(r.d6, headlineHeatScale)}>
                            {r.d6 == null ? "—" : `${r.d6 >= 0 ? "+" : ""}${r.d6.toFixed(2)}`}
                          </div>
                        </td>
                        <td className="py-0.5 pl-1">
                          <div className="rounded-[2px] px-1.5 py-0.5 text-center font-mono tabular-nums" style={matrixCellStyle(r.d12, headlineHeatScale)}>
                            {r.d12 == null ? "—" : `${r.d12 >= 0 ? "+" : ""}${r.d12.toFixed(2)}`}
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="py-1.5">
                        <div className="w-full border-t border-dashed border-[var(--nd-border-soft)]" />
                      </td>
                    </tr>
                    {coreRows.map((r) => (
                      <tr key={r.label}>
                        <td className="py-0.5 pr-1.5 text-center" style={{ color: "var(--nd-soft)" }}>{r.label}</td>
                        <td className="py-0.5 text-center tabular-nums" style={{ color: "var(--nd-text)" }}>
                          {r.now.toFixed(2)}%
                        </td>
                        <td className="py-0.5 pl-1">
                          <div className="rounded-[2px] px-1.5 py-0.5 text-center font-mono tabular-nums" style={matrixCellStyle(r.d3, coreHeatScale)}>
                            {r.d3 == null ? "—" : `${r.d3 >= 0 ? "+" : ""}${r.d3.toFixed(2)}`}
                          </div>
                        </td>
                        <td className="py-0.5 pl-1">
                          <div className="rounded-[2px] px-1.5 py-0.5 text-center font-mono tabular-nums" style={matrixCellStyle(r.d6, coreHeatScale)}>
                            {r.d6 == null ? "—" : `${r.d6 >= 0 ? "+" : ""}${r.d6.toFixed(2)}`}
                          </div>
                        </td>
                        <td className="py-0.5 pl-1">
                          <div className="rounded-[2px] px-1.5 py-0.5 text-center font-mono tabular-nums" style={matrixCellStyle(r.d12, coreHeatScale)}>
                            {r.d12 == null ? "—" : `${r.d12 >= 0 ? "+" : ""}${r.d12.toFixed(2)}`}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 w-full max-w-[430px] rounded-[2px] border border-[var(--nd-border-soft)] px-3 py-2">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
                    <span>Inflation Direction</span>
                    <span>{summarySignal.regime}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-full rounded bg-[rgba(255,255,255,0.08)]">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${(summarySignal.strength * 100).toFixed(0)}%`,
                          background: summarySignal.combo >= 0 ? "rgba(212,93,114,0.75)" : "rgba(114,173,102,0.75)",
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--nd-text)" }}>
                      {summarySignal.combo >= 0 ? "+" : ""}{summarySignal.combo.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </NextDashboardShell>
  );
}

