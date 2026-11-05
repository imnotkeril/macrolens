import type { Metadata } from "next";
import { NextDashboardScreen } from "@/components/next-dashboard/NextDashboardScreen";

export const metadata: Metadata = { title: "Page not found — MacroLens" };

export default function GlobalNotFoundPage() {
  return <NextDashboardScreen mode="not-found" />;
}
