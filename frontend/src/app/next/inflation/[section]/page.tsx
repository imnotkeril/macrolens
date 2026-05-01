import { NextDashboardScreen } from "@/components/next-dashboard/NextDashboardScreen";

type PageProps = {
  params: { section: string };
};

function prettifySection(section: string): string {
  return section.toUpperCase();
}

export default function NextInflationSectionPage({ params }: PageProps) {
  return <NextDashboardScreen mode="placeholder" placeholderTitle={`Inflation — ${prettifySection(params.section)}`} />;
}
