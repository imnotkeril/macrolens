import { redirect } from "next/navigation";

type PageProps = {
  params: { section: string };
};

export default function InflationSectionAliasPage(_props: PageProps) {
  redirect("/inflation");
}
