import { NextPlaceholderPage } from "@/components/next-dashboard/NextPlaceholderPage";

type PageProps = {
  params: { section: string };
};

function prettifySection(section: string): string {
  return section
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function NextAnalysisSectionPage({ params }: PageProps) {
  return <NextPlaceholderPage title={`Analysis — ${prettifySection(params.section)}`} legacyHref="/analysis" />;
}
