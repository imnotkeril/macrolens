import { NextDashboardScreen } from "@/components/next-dashboard/NextDashboardScreen";

type NextPlaceholderPageProps = {
  title: string;
  /** Legacy app route (TopNav layout) until the section is built in the new shell */
  legacyHref?: string;
};

export function NextPlaceholderPage({ title, legacyHref }: NextPlaceholderPageProps) {
  return (
    <NextDashboardScreen mode="placeholder" placeholderTitle={title} placeholderLegacyHref={legacyHref} />
  );
}
