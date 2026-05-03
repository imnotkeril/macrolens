import type { CSSProperties } from "react";

/**
 * Minimal token slice for card/panel chrome in the Next shell.
 * Use `nextDashboardCssTokenColors` from `nextDashboardConfig` (the `C` object on screens).
 */
export type NextPanelSurfaceTokens = {
  panel: string;
  border: string;
};

const INSET_HIGHLIGHT = "inset 0 0 0 1px rgba(255,255,255,0.012)";

/** Default padded panel — matches legacy `panelStyle()` in NextDashboardScreen */
export function nextPanelSurfaceStyle(tokens: NextPanelSurfaceTokens): CSSProperties {
  return {
    background: tokens.panel,
    border: `1px solid ${tokens.border}`,
    borderRadius: "4px",
    padding: "20px 22px",
    boxShadow: INSET_HIGHLIGHT,
    minHeight: 0,
    overflow: "hidden",
  } as const;
}

/** Top dashboard row: fixed visual height for the four-up grid */
export function nextPanelDashboardQuadStyle(tokens: NextPanelSurfaceTokens): CSSProperties {
  return {
    ...nextPanelSurfaceStyle(tokens),
    height: 360,
  };
}

/** Full-height feature panels (recession / macro / fed single-column modes) */
export function nextPanelFillBelowChromeStyle(
  tokens: NextPanelSurfaceTokens,
  offsetPx: number = 160,
): CSSProperties {
  return {
    ...nextPanelSurfaceStyle(tokens),
    minHeight: `calc(100vh - ${offsetPx}px)`,
  };
}
