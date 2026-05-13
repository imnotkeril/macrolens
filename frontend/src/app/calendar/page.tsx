import { redirect } from "next/navigation";

export default function LegacyCalendarPage() {
  redirect("/calendar/briefings");
}
