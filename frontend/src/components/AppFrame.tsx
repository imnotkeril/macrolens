"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@/components/TopNav";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTerminalHome = pathname === "/";
  const isNextShell = pathname.startsWith("/next");

  if (isTerminalHome || isNextShell) {
    return <div className="min-h-screen bg-tn-canvas text-tn-cream antialiased">{children}</div>;
  }

  return (
    <div className="min-h-screen stars">
      <TopNav />
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-6">{children}</main>
    </div>
  );
}
