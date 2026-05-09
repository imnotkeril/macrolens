import type { ReactNode } from "react";
import { NextCalendarHubLayout } from "@/components/next-dashboard/calendar/NextCalendarHubLayout";

export default function CalendarSectionLayout({ children }: { children: ReactNode }) {
  return <NextCalendarHubLayout>{children}</NextCalendarHubLayout>;
}
