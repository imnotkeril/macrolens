"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
type HubNavColors = {
  text: string;
  muted: string;
  borderSoft: string;
  orange: string;
};

const HUB_LINKS = [
  { href: "/calendar/briefings", label: "Briefings" },
  { href: "/calendar/economic-calendar", label: "Calendar" },
  { href: "/calendar/events", label: "Events" },
  { href: "/calendar/fomc-minutes", label: "FOMC Minutes" },
  { href: "/calendar/news", label: "News" },
] as const;

type CalendarHubTopNavProps = {
  colors: HubNavColors;
};

export function CalendarHubTopNav({ colors }: CalendarHubTopNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="mb-3 flex flex-wrap items-center gap-1 border-b pb-2"
      style={{ borderColor: colors.borderSoft }}
      aria-label="Calendar section"
    >
      {HUB_LINKS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-opacity hover:opacity-90"
            style={{
              color: active ? colors.text : colors.muted,
              borderBottom: active ? `2px solid ${colors.orange}` : "2px solid transparent",
              marginBottom: "-2px",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
