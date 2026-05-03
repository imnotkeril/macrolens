/**
 * Public API for the `/next` shell: import from `@/components/next-dashboard`.
 * Prefer these exports over reaching into individual files when building new routes.
 */

export { NextDashboardShell, type SidebarNavItem } from "./NextDashboardShell";
export { NextDashboardScreen } from "./NextDashboardScreen";
export { NextRadarScreen } from "./NextRadarScreen";
export { NextPlaceholderPage } from "./NextPlaceholderPage";
export { NextPanel } from "./NextPanel";
export {
  nextPanelSurfaceStyle,
  nextPanelDashboardQuadStyle,
  nextPanelFillBelowChromeStyle,
  type NextPanelSurfaceTokens,
} from "./nextPanelSurface";
export {
  NEXT_DASHBOARD_NAV_ITEMS,
  nextDashboardCssTokenColors,
  nextDashboardCssVars,
  type NextDashboardThemeMode,
} from "./nextDashboardConfig";
export { NextShellThemeProvider, useNextShellTheme, type NextShellThemeContextValue } from "./nextShellTheme";
