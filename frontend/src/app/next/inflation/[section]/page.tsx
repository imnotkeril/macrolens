import { NextPlaceholderPage } from "@/components/next-dashboard/NextPlaceholderPage";

type PageProps = {
  params: { section: string };
};

function prettifySection(section: string): string {
  return section.toUpperCase();
}

export default function NextInflationSectionPage({ params }: PageProps) {
  return <NextPlaceholderPage title={`Inflation — ${prettifySection(params.section)}`} legacyHref="/indicators" />;
}
