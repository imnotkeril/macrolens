"use client";

import { createContext, useContext, type ReactNode } from "react";

/** When set, dashboard shells stack vertically for multi-section PDF preview instead of fixed full-viewport. */
export type ReportStackMode = {
  embedded: boolean;
  /** Applies print snapshot chrome + `.nd-report-shell` when screens do not pass `reportLayout` themselves. */
  reportLayout: boolean;
  /** Multi-section `/reports/preview`: one outer shell; hide per-page PDF hint rows. */
  compositePreview?: boolean;
};

const ReportStackContext = createContext<ReportStackMode | null>(null);

export function ReportStackProvider({ value, children }: { value: ReportStackMode; children: ReactNode }) {
  return <ReportStackContext.Provider value={value}>{children}</ReportStackContext.Provider>;
}

export function useOptionalReportStack(): ReportStackMode | null {
  return useContext(ReportStackContext);
}
