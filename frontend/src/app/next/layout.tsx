/**
 * All `/next/*` routes share one theme state (dark/light) and token refs via context.
 * Build new pages with `useNextShellTheme()` + `NextDashboardShell`.
 */
export default function NextSegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
