import { redirect } from "next/navigation";

/** Legacy URL — Macro Overview screen. */
export default function NextMacroRatiosRedirectPage() {
  redirect("/next/analysis/macro-overview");
}
