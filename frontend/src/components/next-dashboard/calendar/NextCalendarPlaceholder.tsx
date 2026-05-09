"use client";

import { useMemo } from "react";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";

export function NextCalendarPlaceholder({ title }: { title: string }) {
  const { colors: C } = useNextShellTheme();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);

  return (
    <div style={surface}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
        {title}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: C.soft }}>
        This section is not implemented yet. The layout and navigation are ready; content will follow the next mockups.
      </p>
    </div>
  );
}
