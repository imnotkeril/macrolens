import { redirect } from "next/navigation";

type PageProps = {
  params: { section: string };
};

export default function NextInflationSectionPage({ params }: PageProps) {
  void params.section;
  redirect("/next/inflation");
}
