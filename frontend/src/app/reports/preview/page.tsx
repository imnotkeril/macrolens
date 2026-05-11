import { Suspense } from "react";
import { ReportsPreviewContent } from "@/components/next-dashboard/reports/ReportsPreviewContent";

export default function ReportsPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-white/70">
          Loading preview…
        </div>
      }
    >
      <ReportsPreviewContent />
    </Suspense>
  );
}
