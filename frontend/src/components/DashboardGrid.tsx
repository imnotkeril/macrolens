"use client";

import { useRef, useCallback } from "react";
import LWChart from "./LWChart";
import type { LWChartHandle, LWChartProps } from "./LWChart";
import type { Time, LogicalRange } from "lightweight-charts";

export interface PanelConfig {
  title: string;
  chart: Omit<LWChartProps, "onCrosshairMove" | "onVisibleRangeChange">;
  tooltip?: string;
}

interface Props {
  panels: PanelConfig[];
  columns?: number;
  panelHeight?: number;
  syncCrosshair?: boolean;
  syncTimeScale?: boolean;
}

export default function DashboardGrid({
  panels,
  columns = 2,
  panelHeight = 240,
  syncCrosshair = true,
  syncTimeScale = true,
}: Props) {
  const chartRefs = useRef<Map<number, LWChartHandle>>(new Map());
  const isSyncing = useRef(false);

  const setChartRef = useCallback(
    (idx: number) => (handle: LWChartHandle | null) => {
      if (handle) chartRefs.current.set(idx, handle);
      else chartRefs.current.delete(idx);
    },
    []
  );

  const handleCrosshairMove = useCallback(
    (sourceIdx: number) =>
      (time: Time | null, point: { x: number; y: number } | null) => {
        if (!syncCrosshair || isSyncing.current) return;
        isSyncing.current = true;
        chartRefs.current.forEach((handle, idx) => {
          if (idx === sourceIdx) return;
          if (time && point) {
            handle.setCrosshair(time, point);
          } else {
            handle.clearCrosshair();
          }
        });
        isSyncing.current = false;
      },
    [syncCrosshair]
  );

  const handleVisibleRangeChange = useCallback(
    (sourceIdx: number) => (range: LogicalRange | null) => {
      if (!syncTimeScale || isSyncing.current || !range) return;
      isSyncing.current = true;
      chartRefs.current.forEach((handle, idx) => {
        if (idx === sourceIdx) return;
        handle.setVisibleRange(range);
      });
      isSyncing.current = false;
    },
    [syncTimeScale]
  );

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {panels.map((panel, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-border bg-bg-card p-4 animate-fade-in"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-[10px] font-medium tracking-wider uppercase text-text-muted">
              {panel.title}
            </h3>
            {panel.tooltip && (
              <span
                className="group relative flex-shrink-0 w-4 h-4 rounded-full border border-text-muted/50 flex items-center justify-center cursor-help text-[10px] text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
                title={panel.tooltip}
              >
                ?
              </span>
            )}
          </div>
          <LWChart
            ref={setChartRef(idx)}
            {...panel.chart}
            height={panelHeight}
            periodSelector={panel.chart.periodSelector ?? false}
            onCrosshairMove={handleCrosshairMove(idx)}
            onVisibleRangeChange={handleVisibleRangeChange(idx)}
          />
        </div>
      ))}
    </div>
  );
}
