"use client";

import { useEffect, useState } from "react";
import {
  getRecessionBands,
  getRateHistory,
  getInflationSeries,
} from "@/lib/api";
import type { RecessionBand, FedRate, InflationPoint } from "@/types";

export default function MacroContextStrips() {
  const [bands, setBands] = useState<RecessionBand[]>([]);
  const [rate, setRate] = useState<FedRate | null>(null);
  const [cpi, setCpi] = useState<number | null>(null);

  useEffect(() => {
    getRecessionBands().then(setBands).catch(() => {});
    getRateHistory(1)
      .then((rates) => {
        if (rates.length > 0) setRate(rates[0]);
      })
      .catch(() => {});
    getInflationSeries("CPI", "yoy", 365)
      .then((data) => {
        if (data.length > 0) setCpi(data[data.length - 1].value);
      })
      .catch(() => {});
  }, []);

  const isRecession = bands.length > 0 && !bands[bands.length - 1].end;
  const fedRate = rate ? rate.target_upper : null;

  return (
    <div className="flex gap-3 flex-wrap">
      <StripBadge
        label="Recession"
        value={isRecession ? "Active" : "None"}
        color={isRecession ? "red" : "green"}
      />
      {fedRate !== null && (
        <StripBadge
          label="Fed Rate"
          value={`${fedRate.toFixed(2)}%`}
          color={fedRate > 4.5 ? "red" : fedRate > 2 ? "amber" : "green"}
        />
      )}
      {cpi !== null && (
        <StripBadge
          label="CPI YoY"
          value={`${cpi.toFixed(1)}%`}
          color={cpi > 4 ? "red" : cpi > 2.5 ? "amber" : "green"}
        />
      )}
    </div>
  );
}

function StripBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "red" | "amber";
}) {
  const colorMap = {
    green: "bg-accent-green/10 text-accent-green border-accent-green/20",
    red: "bg-accent-red/10 text-accent-red border-accent-red/20",
    amber: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium ${colorMap[color]}`}
    >
      <span className="text-text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
