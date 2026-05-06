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
import { InflationSingleLineCard } from "./InflationSingleLineCard";
import { NEXT_INFLATION_QUERY_ROOT } from "./inflationQueryKeys";
import { latestDateAcrossSeries } from "./inflationUtils";

export function NextInflationScreen() {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const queryClient = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();

  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const panel = useMemo(() => ({ ...surface, padding: "12px 22px" } as const), [surface]);

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

  const errors = useMemo(() => {
    if (!inflQ.isError) return [];
    return [{ label: "Inflation dashboard", message: String(inflQ.error) }];
  }, [inflQ.isError, inflQ.error]);

  const onRetry = () => void queryClient.invalidateQueries({ queryKey: [NEXT_INFLATION_QUERY_ROOT] });

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
          <div className="min-h-[390px] min-w-0" style={panel}>
            <InflationDualChartCard
              title="CPI"
              yoyPrimary={{ name: "CPI YoY", rows: inflQ.data?.cpi_yoy, color: String(C.green) }}
              yoySecondary={{ name: "Core CPI YoY", rows: inflQ.data?.cpi_core_yoy, color: String(C.purple) }}
              mom={{ name: "CPI MoM", rows: inflQ.data?.cpi_mom }}
              pending={inflQ.isPending}
            />
          </div>
          <div className="min-h-[390px] min-w-0" style={panel}>
            <InflationDualChartCard
              title="PCE"
              subtitle="Fed's Preferred Measure"
              yoyPrimary={{ name: "PCE YoY", rows: inflQ.data?.pce_yoy, color: String(C.green) }}
              yoySecondary={{ name: "Core PCE YoY", rows: inflQ.data?.pce_core_yoy, color: String(C.purple) }}
              mom={{ name: "PCE MoM", rows: inflQ.data?.pce_mom }}
              pending={inflQ.isPending}
            />
          </div>
          <div className="min-h-[390px] min-w-0" style={panel}>
            <InflationDualChartCard
              title="PPI"
              subtitle="Producer Prices"
              yoyPrimary={{ name: "PPI YoY", rows: inflQ.data?.ppi_yoy, color: String(C.green) }}
              yoySecondary={{ name: "Core PPI YoY", rows: inflQ.data?.ppi_core_yoy, color: String(C.purple) }}
              mom={{ name: "PPI MoM", rows: inflQ.data?.ppi_mom }}
              pending={inflQ.isPending}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
          <div className="min-h-[318px] min-w-0" style={panel}>
            <InflationSingleLineCard
              title="STICKY CPI EX F&E"
              subtitle="Atlanta Fed"
              rows={inflQ.data?.sticky_cpi}
              lineColor={String(C.red)}
              pending={inflQ.isPending}
            />
          </div>
          <div className="min-h-[318px] min-w-0" style={panel}>
            <InflationSingleLineCard
              title="MICHIGAN 5Y INFLATION EXPECTATIONS"
              rows={inflQ.data?.mich}
              lineColor={String(C.yellow)}
              pending={inflQ.isPending}
            />
          </div>
          <div className="min-h-[318px] min-w-0" style={panel}>
            <InflationSingleLineCard
              title="5Y BREAKEVEN INFLATION"
              subtitle="T5YIE"
              rows={inflQ.data?.t5yie}
              lineColor={String(C.orange)}
              pending={inflQ.isPending}
            />
          </div>
          <div className="min-h-[318px] min-w-0" style={panel}>
            <InflationSingleLineCard
              title="10Y BREAKEVEN INFLATION"
              subtitle="T10YIE"
              rows={inflQ.data?.t10yie}
              lineColor="#d96fb0"
              pending={inflQ.isPending}
            />
          </div>
        </div>
      </section>
    </NextDashboardShell>
  );
}

