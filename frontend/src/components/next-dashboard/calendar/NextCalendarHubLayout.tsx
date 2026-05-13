"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { useDataRefresh } from "@/lib/useDataRefresh";
import { CalendarHubTopNav } from "@/components/next-dashboard/calendar/CalendarHubTopNav";

export function NextCalendarHubLayout({ children }: { children: ReactNode }) {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();

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
      {children}
    </NextDashboardShell>
  );
}
