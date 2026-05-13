import { NextMacroSentimentScreen } from "@/components/next-dashboard/NextMacroSentimentScreen";

type PageProps = {
  params: { section: string };
};

export default function MacroSentimentSectionPage({ params }: PageProps) {
  return <NextMacroSentimentScreen sectionSlug={params.section} />;
}
