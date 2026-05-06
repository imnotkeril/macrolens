import { NextInflationScreen } from "@/components/next-dashboard/inflation/NextInflationScreen";

type PageProps = {
  params: { section: string };
};

export default function NextInflationSectionPage({ params }: PageProps) {
  void params.section;
  return <NextInflationScreen />;
}
