"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { useDataRefresh } from "@/lib/useDataRefresh";
import { CalendarHubTopNav } from "@/components/next-dashboard/calendar/CalendarHubTopNav";

/** Hub screens that still render static demo data (briefings, economic calendar, events explorer, news). */
const DEMO_DATA_PATHS = [
  "/calendar/briefings",
  "/calendar/economic-calendar",
  "/calendar/events",
  "/calendar/news",
];

export function NextCalendarHubLayout({ children }: { children: ReactNode }) {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const pathname = usePathname() ?? "";
  const showDemoBanner = DEMO_DATA_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const hubColors = useMemo(
    () => ({
      text: C.text,
      muted: C.muted,
      borderSoft: C.borderSoft,
      orange: C.orange,
    }),
    [C.text, C.muted, C.borderSoft, C.orange],
  );

  const [updatedAt, setUpdatedAt] = useState("—");
  useEffect(() => {
    setUpdatedAt(new Date().toISOString());
  }, []);

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
      <CalendarHubTopNav colors={hubColors} />
      {showDemoBanner ? (
        <div
          role="status"
          className="mb-2 rounded border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{
            borderColor: C.yellow,
            color: C.yellow,
            background: "color-mix(in srgb, var(--nd-yellow) 10%, transparent)",
          }}
        >
          Demo data - not live. The figures on this screen are static samples, not market data.
        </div>
      ) : null}
      {children}
    </NextDashboardShell>
  );
}
