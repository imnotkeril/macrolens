"use client";

import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";
import { nextPanelSurfaceStyle, type NextPanelSurfaceTokens } from "@/components/next-dashboard/nextPanelSurface";

type DivProps = ComponentPropsWithoutRef<"div">;

export type NextPanelProps = Omit<DivProps, "style"> & {
  /** Panel + border tokens (typically `C.panel` / `C.border` from `nextDashboardCssTokenColors`) */
  surface: NextPanelSurfaceTokens;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * Standard chrome for content inside `NextDashboardShell`.
 * Prefer this over ad-hoc borders so migrated pages stay visually aligned.
 */
export function NextPanel({ surface, style, children, ...rest }: NextPanelProps) {
  return (
    <div style={{ ...nextPanelSurfaceStyle(surface), ...style }} {...rest}>
      {children}
    </div>
  );
}
