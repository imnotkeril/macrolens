/**
 * `/reports/preview` renders screens with `omitShell` inside a stacked shell. Dense analysis grids
 * elsewhere rely on flex-1 + CSS Grid `1fr` rows; that collapses when ancestors participate in flex
 * height division. Dashboard report uses plain grid; Relative Performance uses fixed px heights —
 * these helpers give embed mode a px floor without affecting full-page routes.
 */
export function reportEmbedDenseGridClass(omitShell: boolean) {
  return omitShell ? "min-h-[960px] shrink-0" : "min-h-0 flex-1";
}

export function reportEmbedSectionClass(omitShell: boolean) {
  return omitShell
    ? "flex shrink-0 flex-col gap-3 print:flex-none print:h-auto print:min-h-0"
    : "flex min-h-0 flex-1 flex-col gap-3 print:flex-none print:h-auto print:min-h-0";
}
