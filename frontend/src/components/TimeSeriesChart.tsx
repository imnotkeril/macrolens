"use client";

import { useMemo } from "react";
import LWChart from "./LWChart";
import type { SeriesConfig, ThresholdLine, RecessionBand } from "./LWChart";

interface LineConfig {
  key: string;
  color: string;
  label: string;
  dashed?: boolean;
  type?: "line" | "area";
}

interface Props {
  data: Array<{ date: string }>;
  lines: LineConfig[];
  thresholds?: { value: number; color: string; label: string }[];
  recessionBands?: RecessionBand[];
  periodSelector?: boolean;
  height?: number;
  yDomain?: [number | "auto", number | "auto"];
  formatValue?: (v: number) => string;
}

/**
 * Backward-compatible wrapper around LWChart.
 * Accepts the same props as the old Recharts-based TimeSeriesChart.
 */
export default function TimeSeriesChart({
  data,
  lines,
  thresholds,
  recessionBands,
  periodSelector = true,
  height = 280,
  yDomain,
  formatValue,
}: Props) {
  const seriesConfigs: SeriesConfig[] = useMemo(
    () =>
      lines.map((l) => ({
        key: l.key,
        label: l.label,
        color: l.color,
        type: l.type === "area" ? "area" : "line",
        dashed: l.dashed,
      })),
    [lines]
  );

  const lwThresholds: ThresholdLine[] | undefined = useMemo(
    () =>
      thresholds?.map((t) => ({
        value: t.value,
        color: t.color,
        label: t.label,
      })),
    [thresholds]
  );

  return (
    <LWChart
      data={data}
      series={seriesConfigs}
      thresholds={lwThresholds}
      recessionBands={recessionBands}
      periodSelector={periodSelector}
      height={height}
      yDomain={yDomain}
      formatValue={formatValue}
    />
  );
}
