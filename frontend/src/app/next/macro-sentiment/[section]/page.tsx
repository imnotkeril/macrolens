import { NextDashboardScreen } from "@/components/next-dashboard/NextDashboardScreen";

type PageProps = {
  params: { section: string };
};

function prettifySection(section: string): string {
  return section
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function NextMacroSentimentSectionPage({ params }: PageProps) {
  return <NextDashboardScreen mode="placeholder" placeholderTitle={`Macro sentiment — ${prettifySection(params.section)}`} />;
}
