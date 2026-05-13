import type { ReactNode } from "react";
import { NextCalendarHubLayout } from "@/components/next-dashboard/calendar/NextCalendarHubLayout";

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return <NextCalendarHubLayout>{children}</NextCalendarHubLayout>;
}
