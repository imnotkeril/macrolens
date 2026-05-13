"use client";

import { usePathname } from "next/navigation";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTerminalHome = pathname === "/";
  const isNextShell = pathname.startsWith("/next");

  if (isTerminalHome || isNextShell) {
    return <div className="min-h-screen bg-tn-canvas text-tn-cream antialiased">{children}</div>;
  }

  // Legacy shell is fully removed: unknown/old paths should never show old top navigation.
  return <div className="min-h-screen bg-tn-canvas text-tn-cream antialiased">{children}</div>;
}
