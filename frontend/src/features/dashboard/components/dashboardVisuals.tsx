"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Home, LineChart, Package, ShoppingCart, TrendingUp, Users } from "lucide-react";
import type { CategoryScore, CrossAssetSignal, YieldCurveSnapshot } from "@/types";
import { CATEGORY_LABELS } from "@/lib/utils";

const C = {
  bg: "var(--nd-bg)",
  panel: "var(--nd-panel)",
  panelSoft: "var(--nd-panel-soft)",
  border: "var(--nd-border)",
  borderSoft: "var(--nd-border-soft)",
  text: "var(--nd-text)",
  soft: "var(--nd-soft)",
  muted: "var(--nd-muted)",
  green: "var(--nd-green)",
  red: "var(--nd-red)",
  yellow: "var(--nd-yellow)",
  blue: "var(--nd-blue)",
};

const YIELD_MATURITY_ORDER = ["3M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"] as const;

const YIELD_CURVE_SERIES_COLORS = {
  now: "#79ad76",
  m3: C.red,
  m6: "#d4b35e",
  y1: "#6a8ec4",
} as const;

const YIELD_HISTORY_STYLE = [
  { key: "m3" as const, opacity: 0.78, dash: [5, 5] as [number, number] },
  { key: "m6" as const, opacity: 0.76, dash: [4, 4] as [number, number] },
  { key: "y1" as const, opacity: 0.74, dash: [6, 4] as [number, number] },
];

const CATEGORY_PHASE: Record<string, string> = {
  housing: "Leading",
  orders: "Leading",
  income_sales: "Coincident",
  employment: "Lagging",
  inflation: "Coincident",
};

export type CrossAssetDisplaySignal = {
  name: string;
  description: string;
  signal: CrossAssetSignal["signal"];
  value: number | null;
  unit?: string;
};

export function SectionTitle({ label, sub, centered = false }: { label: string; sub?: string; centered?: boolean }) {
  return (
    <div className={`mb-1 ${centered ? "text-center" : ""}`}>
      <div className="text-[18px] uppercase leading-none tracking-[0.08em]">{label}</div>
      {sub ? <div className="mt-3 text-[13px] tracking-[0.02em]" style={{ color: C.text }}>{sub}</div> : null}
    </div>
  );
}

export function ConfidenceSegments({ value }: { value: number }) {
  const safeValue = clamp(value, 0, 100);
  return (
    <div className="flex flex-1 gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => {
        const fill = clamp(safeValue - i * 10, 0, 10) * 10;
        return (
          <span key={i} className="relative h-[6px] flex-1 overflow-hidden rounded-[2px]" style={{ background: C.border }}>
            <span className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `${fill}%`, background: C.green }} />
          </span>
        );
      })}
    </div>
  );
}

export function MacroNavigatorSvg({
  growthScore,
  fedPolicy,
  ensembleGrowth,
  ensembleFed,
}: {
  growthScore: number;
  fedPolicy: number;
  ensembleGrowth: number | null;
  ensembleFed: number | null;
}) {
  const nowX = 310 + clamp(growthScore, -1, 1) * 78;
  const nowY = 195 - clamp(fedPolicy, -1, 1) * 72;
  const ensembleX = 310 + clamp(ensembleGrowth ?? -0.18, -1, 1) * 78;
  const ensembleY = 195 - clamp(ensembleFed ?? 0.16, -1, 1) * 72;
  const redPast = "#c84f63";
  const redPastSoft = "#c88092";
  const greenAheadSoft = "#93c786";
  const greenAhead = C.green;
  const neutralNow = "#cfc8bd";
  const ensemblePurple = "#b99ad8";

  return (
    <svg className="h-full w-full" viewBox="0 0 620 390" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <line x1="310" y1="42" x2="310" y2="344" stroke={C.border} strokeWidth="1" />
      <line x1="118" y1="195" x2="502" y2="195" stroke={C.border} strokeWidth="1" />
      <line x1="310" y1="42" x2="310" y2="344" stroke={C.muted} strokeWidth="1" strokeDasharray="1 62" opacity="0.5" />
      <line x1="118" y1="195" x2="502" y2="195" stroke={C.muted} strokeWidth="1" strokeDasharray="28 28" opacity="0.35" />

      <text x="170" y="102" fill={C.blue} fontSize="18" letterSpacing="1.3">GROWTH</text>
      <text x="417" y="102" fill={C.green} fontSize="18" letterSpacing="1.3">RISK ON</text>
      <text x="170" y="314" fill={C.red} fontSize="18" letterSpacing="1.3">RISK OFF</text>
      <text x="420" y="314" fill={C.yellow} fontSize="18" letterSpacing="1.3">VALUE</text>

      <text x="310" y="27" fill={C.soft} fontSize="11" textAnchor="middle">FED POLICY (EASY)</text>
      <text x="310" y="365" fill={C.soft} fontSize="11" textAnchor="middle">FED POLICY (TIGHT)</text>
      <text x="24" y="199" fill={C.soft} fontSize="11">MACRO</text>
      <text x="24" y="214" fill={C.soft} fontSize="11">SENTIMENT</text>
      <text x="554" y="199" fill={C.soft} fontSize="11">MACRO</text>
      <text x="554" y="214" fill={C.soft} fontSize="11">SENTIMENT</text>

      <line x1="176" y1="250" x2="224" y2="164" stroke={redPast} strokeWidth="1.6" strokeDasharray="5 7" />
      <line x1="224" y1="164" x2={nowX} y2={nowY} stroke={redPastSoft} strokeWidth="1.6" strokeDasharray="5 7" />
      <line x1={nowX} y1={nowY} x2="382" y2="102" stroke={greenAheadSoft} strokeWidth="1.6" strokeDasharray="5 7" />
      <line x1="382" y1="102" x2="432" y2="250" stroke={greenAhead} strokeWidth="1.6" strokeDasharray="5 7" />

      <circle cx="176" cy="250" r="8" fill={redPast} />
      <circle cx="224" cy="164" r="8" fill={redPastSoft} />
      <circle cx="382" cy="102" r="8" fill={greenAheadSoft} />
      <circle cx="432" cy="250" r="8" fill={greenAhead} />
      <text x="185" y="267" fill={redPast} fontSize="11">1Y-</text>
      <text x="198" y="154" fill={redPastSoft} fontSize="11">6M-</text>
      <text x="393" y="105" fill={greenAheadSoft} fontSize="11">6M+</text>
      <text x="444" y="254" fill={greenAhead} fontSize="11">1Y+</text>

      <circle cx={ensembleX} cy={ensembleY} r="7" fill={ensemblePurple} opacity="0.9" />
      <text x={ensembleX + 10} y={ensembleY - 9} fill={ensemblePurple} fontSize="10">ENSEMBLE</text>

      <circle cx={nowX} cy={nowY} r="8" fill={neutralNow} stroke={C.border} strokeWidth="2" />
      <rect x={nowX + 16} y={nowY - 13} width="36" height="24" rx="2" fill="#c4beb3" stroke={C.border} />
      <text x={nowX + 34} y={nowY + 3} fill={C.bg} fontSize="12" fontWeight="600" textAnchor="middle">NOW</text>
    </svg>
  );
}

export function SignalRow({ signal }: { signal: CrossAssetDisplaySignal }) {
  const value = signal.value == null ? "N/A" : `${signal.value > 0 ? "+" : ""}${signal.value.toFixed(1)}${signal.unit ?? "%"}`;
  return (
    <div
      className="grid items-center border-b"
      style={{
        borderColor: C.border,
        gridTemplateColumns: "minmax(0, 1.04fr) minmax(0, 1.56fr) 162px",
        columnGap: 8,
        padding: "4px 0",
      }}
    >
      <div className="min-w-0">
        <div className="truncate text-[12px] uppercase tracking-[0.03em]">{signal.name}</div>
        <div className="mt-0.5 truncate text-[10px]" style={{ color: C.soft }}>{signal.description}</div>
      </div>
      <div className="min-w-0 pr-0.5">
        <Sparkline points={series(signal.name, signal.signal, 22)} color={signalColor(signal.signal)} width={280} height={22} responsive responsiveMode="fixed-height" />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <span className="min-w-[88px] whitespace-nowrap rounded-[2px] px-2 py-1 text-center text-[9px] uppercase tracking-[0.06em]" style={{ background: badgeColor(signal.signal), color: badgeTextColor(signal.signal) }}>{badgeText(signal.signal)}</span>
        <div className="min-w-[56px] whitespace-nowrap text-right text-[12px] tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export function QuickRow({
  label,
  value,
  secondaryValue,
  delta,
  min,
  mid,
  max,
  format,
  sub,
  higherIsWorse = false,
  gradient,
  palette,
  compact = false,
}: {
  label: string;
  value: number | null;
  secondaryValue?: number | null;
  delta?: number | null;
  min: number;
  mid: number;
  max: number;
  format: "number" | "percent" | "basis_points";
  sub?: string;
  higherIsWorse?: boolean;
  gradient?: string;
  palette?: readonly [string, string, string];
  compact?: boolean;
}) {
  const safe = value == null ? mid : clamp(value, min, max);
  const secondarySafe = secondaryValue == null ? null : clamp(secondaryValue, min, max);
  const ratio = clamp((safe - min) / (max - min), 0, 1);
  const secondaryRatio = secondarySafe == null ? null : clamp((secondarySafe - min) / (max - min), 0, 1);
  const display = value == null ? "N/A" : format === "percent" ? fmtPct(value, 1) : format === "basis_points" ? `${value.toFixed(0)}bp` : value.toFixed(2);
  const deltaDisplay = formatDeltaByFormat(delta ?? null, format);
  const deltaArrow = delta == null ? "→" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const deltaColor = delta == null ? C.soft : higherIsWorse ? (delta > 0 ? C.red : delta < 0 ? C.green : C.soft) : (delta > 0 ? C.green : delta < 0 ? C.red : C.soft);
  const midRatio = clamp((mid - min) / (max - min), 0, 1);
  const titleSize = compact ? "text-[12px]" : "text-[14px]";
  const subSize = compact ? "text-[10px]" : "text-[11px]";
  const valueSize = compact ? "text-[18px]" : "text-[20px]";
  const headerGap = compact ? "mb-2" : "mb-4";
  const scaleGap = compact ? "mt-2" : "mt-3";
  return (
    <div>
      <div className={`${headerGap} flex items-end justify-between`}>
        <div>
          <div className={`${titleSize} uppercase tracking-[0.06em]`} style={{ color: C.text }}>{label}</div>
          <div className={`mt-1 ${subSize} uppercase`} style={{ color: C.soft }}>{sub ?? (format === "percent" ? "composite" : "z-score")}</div>
        </div>
        <div className={`${valueSize} leading-none tabular-nums whitespace-nowrap`}>{deltaDisplay} <span style={{ color: deltaColor }}>{deltaArrow}</span></div>
      </div>
      <div className="relative h-[6px] rounded" style={{ background: C.border }}>
        <div className="h-[6px] rounded" style={{ width: `${ratio * 100}%`, background: gradient ?? C.green }} />
        {secondaryRatio != null ? (
          <div
            className="absolute inset-y-0 left-0 rounded"
            style={{ width: `${secondaryRatio * 100}%`, background: "#88f3cb", opacity: 0.45, boxShadow: "0 0 6px rgba(136,243,203,0.25)" }}
          />
        ) : null}
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-shadow hover:shadow-[0_0_0_2px_rgba(215,208,199,0.35)]"
          style={{ left: `${ratio * 100}%`, background: pointColorFromPalette(ratio, palette, higherIsWorse), borderColor: C.panel }}
          title={`${label}: ${display}`}
        />
        <span className="absolute top-[-5px] h-4 w-px" style={{ left: `${midRatio * 100}%`, background: "#777" }} />
      </div>
      <div className={`${scaleGap} flex justify-between text-[12px]`} style={{ color: C.soft }}>
        <span>{formatTick(min, format)}</span><span>{formatTick(mid, format)}</span><span>{formatTick(max, format)}</span>
      </div>
    </div>
  );
}

export function InflationQuickRow({
  cpiValue,
  coreValue,
  cpiDelta,
  coreDelta,
}: {
  cpiValue: number | null;
  coreValue: number | null;
  cpiDelta: number | null;
  coreDelta: number | null;
}) {
  const min = 0;
  const target = 2;
  const mid = 3;
  const max = 6;
  const cpi = cpiValue == null ? mid : clamp(cpiValue, min, max);
  const core = coreValue == null ? null : clamp(coreValue, min, max);
  const ratio = clamp((cpi - min) / (max - min), 0, 1);
  const coreRatio = core == null ? null : clamp((core - min) / (max - min), 0, 1);
  const targetRatio = (target - min) / (max - min);
  const midRatio = (mid - min) / (max - min);
  const displayDelta = formatDelta(cpiDelta, "%");
  const coreDeltaDisplay = formatDelta(coreDelta, "%");
  const deltaArrow = cpiDelta == null ? "→" : cpiDelta > 0 ? "↑" : cpiDelta < 0 ? "↓" : "→";
  const cpiDisplay = cpiValue == null ? "N/A" : `${cpiValue.toFixed(1)}%`;
  const coreDisplay = coreValue == null ? "N/A" : `${coreValue.toFixed(1)}%`;
  const pointColor = pointColorFromPalette(ratio, ["#6db77a", "#c9b55d", "#c66b74"], true);

  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <div className="text-[12px] uppercase tracking-[0.06em]" style={{ color: C.text }}>Inflation</div>
          <div className="mt-1 text-[10px] uppercase" style={{ color: C.soft }}>CPI YoY</div>
        </div>
        <div className="text-right text-[18px] leading-none tabular-nums">
          {displayDelta.value} <span style={{ color: displayDelta.color }}>{deltaArrow}</span>
        </div>
      </div>
      <div className="relative h-[6px] rounded" style={{ background: C.border }}>
        <div
          className="h-[6px] rounded"
          style={{
            width: `${ratio * 100}%`,
            background: "linear-gradient(90deg, rgba(80,168,106,0.9) 0%, rgba(130,186,86,0.86) 52%, rgba(211,171,73,0.9) 78%, rgba(194,84,97,0.92) 100%)",
          }}
        />
        {coreRatio != null ? (
          <span
            className="absolute inset-y-0 left-0 rounded"
            style={{
              width: `${coreRatio * 100}%`,
              background: "linear-gradient(90deg, rgba(121,248,214,0.56) 0%, rgba(121,248,214,0.24) 100%)",
              boxShadow: "0 0 8px rgba(121,248,214,0.32)",
            }}
          />
        ) : null}
        <span className="absolute top-[-6px] h-[22px] w-px" style={{ left: `${targetRatio * 100}%`, background: "#9f88df" }} />
        <span className="absolute top-[-6px] h-[22px] w-px" style={{ left: `${midRatio * 100}%`, background: "rgba(220,214,205,0.6)" }} />
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-shadow hover:shadow-[0_0_0_2px_rgba(215,208,199,0.35)]"
          style={{ left: `${ratio * 100}%`, background: pointColor, borderColor: C.panel }}
          title={`Current CPI: ${cpiDisplay} (${displayDelta.value})\nCore CPI: ${coreDisplay} (${coreDeltaDisplay.value})`}
        />
      </div>
      <div className="relative mt-2 h-4 text-[11px]" style={{ color: C.soft }}>
        <span className="absolute left-0 -translate-x-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${targetRatio * 100}%`, color: "#9f88df" }}>2</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${midRatio * 100}%` }}>3</span>
        <span className="absolute right-0 translate-x-0">6</span>
      </div>
    </div>
  );
}

export function FedPolicyScaleBar({ value }: { value: number }) {
  const safe = clamp(value, -2, 2);
  const ratio = clamp((safe + 2) / 4, 0, 1);
  const pointerColor = pointColorFromPalette(ratio, ["#6db77a", "#c9b55d", "#c66b74"], true);
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between px-0.5 text-[12px] tabular-nums" style={{ color: C.soft }}>
        <span>-2</span>
        <span>0</span>
        <span>+2</span>
      </div>
      <div className="relative h-[6px] rounded" style={{ background: C.border }}>
        <div
          className="h-[6px] rounded"
          style={{
            background:
              "linear-gradient(90deg, rgba(96,186,125,0.9) 0%, rgba(184,199,112,0.86) 50%, rgba(201,97,109,0.9) 100%)",
          }}
        />
        <span className="absolute top-[-5px] h-4 w-px" style={{ left: "50%", background: "rgba(220,214,205,0.6)" }} />
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-shadow hover:shadow-[0_0_0_2px_rgba(215,208,199,0.35)]"
          style={{ left: `${ratio * 100}%`, background: pointerColor, borderColor: C.panel }}
          title={`Fed policy score: ${fmtNumber(safe)}`}
        />
      </div>
    </div>
  );
}

export function FedRateHistorySpark({ values }: { values: number[] }) {
  const rawPts = useMemo(() => {
    const clean = values.filter((v) => Number.isFinite(v));
    return clean.length ? clean : [0];
  }, [values]);
  const pts = rawPts.length >= 2 ? rawPts : [rawPts[0], rawPts[0]];
  const minRaw = useMemo(() => Math.min(...rawPts), [rawPts]);
  const maxRaw = useMemo(() => Math.max(...rawPts), [rawPts]);
  const range = useMemo(() => Math.max(0.25, maxRaw - minRaw), [minRaw, maxRaw]);
  const pad = Math.max(range * 0.12, 0.05);
  const yMin = minRaw - pad;
  const yMax = maxRaw + pad;
  const yMid = (yMin + yMax) / 2;
  const svgW = 300;
  const svgH = 74;
  const plotLeft = 0;
  const plotRight = 258;
  const plotTop = 4;
  const plotBottom = 70;
  const plotW = plotRight - plotLeft;
  const pointsCount = Math.max(1, pts.length - 1);
  const yAt = (v: number) => {
    const ratio = clamp((v - yMin) / (yMax - yMin), 0, 1);
    return plotBottom - ratio * (plotBottom - plotTop);
  };
  const stepPath = (() => {
    let d = "";
    for (let i = 0; i < pts.length; i += 1) {
      const x = plotLeft + (i / pointsCount) * plotW;
      const y = yAt(pts[i]);
      if (i === 0) {
        d = `M${x.toFixed(2)} ${y.toFixed(2)}`;
      } else {
        const prevY = yAt(pts[i - 1]);
        d += ` L${x.toFixed(2)} ${prevY.toFixed(2)} L${x.toFixed(2)} ${y.toFixed(2)}`;
      }
    }
    return d;
  })();
  const areaPath = `${stepPath} L${plotRight.toFixed(2)} ${plotBottom.toFixed(2)} L${plotLeft.toFixed(2)} ${plotBottom.toFixed(2)} Z`;
  const changeMarkers = pts
    .map((value, index) => ({ value, index }))
    .filter((point) => point.index > 0 && Math.abs(point.value - pts[point.index - 1]) >= 0.01);
  const formatRateAxisLabel = (num: number) =>
    `${num.toFixed(range < 0.6 ? 2 : 1).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}%`;

  return (
    <div className="relative h-[74px] min-h-[74px] w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 right-7 top-0 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="absolute left-0 right-7 top-1/2 h-px -translate-y-1/2" style={{ background: "rgba(255,255,255,0.07)" }} />
        <div className="absolute bottom-0 left-0 right-7 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>
      <div className="h-full w-full pr-7">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" className="block h-full w-full min-w-0">
          <path d={areaPath} fill={C.green} opacity={0.1} />
          <path d={stepPath} fill="none" stroke={C.green} strokeWidth={1.4} strokeLinecap="butt" strokeLinejoin="miter" />
          {changeMarkers.map((marker) => {
            const x = plotLeft + (marker.index / pointsCount) * plotW;
            const y = yAt(marker.value);
            return <circle key={`fed-step-${marker.index}`} cx={x} cy={y} r={1.7} fill={C.green} />;
          })}
        </svg>
      </div>
      <span className="pointer-events-none absolute right-0 top-0 text-[10px] tabular-nums leading-none" style={{ color: C.muted }}>
        {formatRateAxisLabel(yMax)}
      </span>
      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] tabular-nums leading-none" style={{ color: C.muted }}>
        {formatRateAxisLabel(yMid)}
      </span>
      <span className="pointer-events-none absolute bottom-0 right-0 text-[10px] tabular-nums leading-none" style={{ color: C.muted }}>
        {formatRateAxisLabel(yMin)}
      </span>
    </div>
  );
}

function Sparkline({
  points,
  color,
  width = 70,
  height = 18,
  fill,
  fillOpacity = 0.16,
  responsive = false,
  responsiveMode = "stretch",
  strokeWidth = 1.9,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
  fill?: boolean;
  fillOpacity?: number;
  responsive?: boolean;
  responsiveMode?: "stretch" | "fit" | "fixed-height";
  strokeWidth?: number;
}) {
  if (!points.length) return null;
  const padY = fill ? 3 : 0;
  const innerH = height - padY * 2;
  const step = width / Math.max(1, points.length - 1);
  const yAt = (p: number) => padY + innerH - (p / 100) * innerH;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)} ${yAt(p).toFixed(2)}`).join(" ");
  const area = `${d} L${width} ${height} L0 ${height} Z`;
  const svgHeight = responsive ? (responsiveMode === "fixed-height" ? height : "100%") : height;
  const svgClass = responsive
    ? (responsiveMode === "fixed-height" ? "block w-full min-w-0" : "block h-full w-full min-w-0")
    : undefined;
  const preserveAspectRatio = responsive
    ? (responsiveMode === "fit" ? "xMidYMid meet" : "none")
    : "xMidYMid meet";
  return (
    <svg
      width={responsive ? "100%" : width}
      height={svgHeight}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={preserveAspectRatio}
      className={svgClass}
      style={{ overflow: "visible" }}
    >
      {fill ? <path d={area} fill={color} opacity={fillOpacity} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="butt" strokeLinejoin="miter" />
    </svg>
  );
}

export function RiskSegmentDonut({ value }: { value: number | null | undefined }) {
  if (value == null || Number.isNaN(value)) {
    return (
      <div
        className="shrink-0 rounded-full border"
        style={{
          width: "clamp(64px, 10vw, 98px)",
          height: "clamp(64px, 10vw, 98px)",
          borderColor: C.border,
          background: C.panelSoft,
          padding: "clamp(10px, 1.9vw, 17px)",
        }}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full text-[11px]" style={{ color: C.muted }}>
          N/A
        </div>
      </div>
    );
  }
  const safe = clamp(value, 0, 100);
  const litSegments = Math.floor(safe / 10);
  const segmentPalette = ["#6fb97b", "#72bd7f", "#79c286", "#b8b25c", "#c3b75f", "#d0be64", "#be6f7c", "#c36777", "#cb5f71", "#bc4856"];
  const inactive = "rgba(54,66,79,0.66)";
  const gap = 3.4;
  const slice = 360 / 10;
  const ringBg = "#0d141d";
  const gradient = Array.from({ length: 10 }).flatMap((_, i) => {
      const segStart = i * slice;
      const segEnd = (i + 1) * slice;
      const start = segStart + gap * 0.5;
      const end = segEnd - gap * 0.5;
      const fill = clamp((safe - i * 10) / 10, 0, 1);
      const activeColor = segmentPalette[i];
      const chunks = [`${ringBg} ${segStart}deg ${start}deg`];
      if (fill <= 0) {
        chunks.push(`${inactive} ${start}deg ${end}deg`);
      } else if (fill >= 1) {
        chunks.push(`${activeColor} ${start}deg ${end}deg`);
      } else {
        const split = start + (end - start) * fill;
        chunks.push(`${activeColor} ${start}deg ${split}deg`);
        chunks.push(`${inactive} ${split}deg ${end}deg`);
      }
      chunks.push(`${ringBg} ${end}deg ${segEnd}deg`);
      return chunks;
    })
    .join(", ");
  const showExclamation = litSegments >= 10;
  return (
    <div
      className="shrink-0 rounded-full border"
      style={{
        width: "clamp(64px, 10vw, 98px)",
        height: "clamp(64px, 10vw, 98px)",
        borderColor: C.border,
        background: `conic-gradient(from -90deg, ${gradient})`,
        padding: "clamp(10px, 1.9vw, 17px)",
        position: "relative",
      }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full" style={{ background: C.panelSoft }}>
        {showExclamation ? <span className="text-[28px] leading-none" style={{ color: "#cb5161" }}>!</span> : null}
      </div>
    </div>
  );
}

export function MacroSentimentSparkBlock({ values }: { values: number[] }) {
  const rawPts = useMemo(() => values.filter((v) => Number.isFinite(v)), [values]);
  // Hooks must run unconditionally — branch only in JSX (see Rules of Hooks).
  const minValue = useMemo(
    () => (rawPts.length >= 2 ? Math.min(...rawPts) : 0),
    [rawPts],
  );
  const maxValue = useMemo(
    () => (rawPts.length >= 2 ? Math.max(...rawPts) : 1),
    [rawPts],
  );
  const safeRange = useMemo(() => Math.max(0.4, maxValue - minValue), [maxValue, minValue]);

  if (rawPts.length < 2) {
    return (
      <div
        className="flex h-[72px] min-h-[72px] items-center justify-center rounded-[2px] text-[11px]"
        style={{ color: C.muted, background: "rgba(255,255,255,0.02)" }}
      >
        {rawPts.length === 0 ? "No macro sentiment history yet." : "Need at least two points for sparkline."}
      </div>
    );
  }
  const padding = safeRange * 0.1;
  const yMin = minValue - padding;
  const yMax = maxValue + padding;
  const yMid = (yMin + yMax) / 2;
  const svgW = 300;
  const svgH = 64;
  const plotLeft = 0;
  const plotRight = 258;
  const plotTop = 8;
  const plotBottom = 56;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  const pointsCount = Math.max(1, rawPts.length - 1);
  const yAt = (v: number) => plotBottom - ((v - yMin) / (yMax - yMin)) * plotH;

  const linePath = rawPts
    .map((v, i) => {
      const x = plotLeft + (i / pointsCount) * plotW;
      const y = yAt(v);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${linePath} L${plotRight} ${plotBottom} L${plotLeft} ${plotBottom} Z`;
  const midY = clamp(yAt(yMid), plotTop, plotBottom);
  const topLabelPct = (plotTop / svgH) * 100;
  const midLabelPct = (midY / svgH) * 100;
  const bottomLabelPct = (plotBottom / svgH) * 100;

  return (
    <div className="relative h-[72px] min-h-[72px] min-w-0 w-full overflow-hidden">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" className="block h-full w-full min-w-0">
        <line x1={plotLeft} x2={plotRight} y1={plotTop} y2={plotTop} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={plotLeft} x2={plotRight} y1={midY} y2={midY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <path d={areaPath} fill={C.green} opacity={0.1} />
        <path d={linePath} fill="none" stroke={C.green} strokeWidth="1.35" strokeLinecap="butt" strokeLinejoin="miter" />
      </svg>
      <span className="pointer-events-none absolute right-0 text-[10px] tabular-nums leading-none" style={{ top: `${topLabelPct}%`, transform: "translateY(-40%)", color: C.muted }}>{formatAxisValue(yMax)}</span>
      <span className="pointer-events-none absolute right-0 text-[10px] tabular-nums leading-none" style={{ top: `${midLabelPct}%`, transform: "translateY(-50%)", color: C.muted }}>{formatAxisValue(yMid)}</span>
      <span className="pointer-events-none absolute right-0 text-[10px] tabular-nums leading-none" style={{ top: `${bottomLabelPct}%`, transform: "translateY(-60%)", color: C.muted }}>{formatAxisValue(yMin)}</span>
    </div>
  );
}

export function MacroCategoryRow({ row }: { row: CategoryScore }) {
  const Icon = categoryIcon(row.category);
  const label = CATEGORY_LABELS[row.category] ?? row.category.replace("_", " ");
  const phase = CATEGORY_PHASE[row.category] ?? "Coincident";
  const TrendIcon = row.trend === "improving" ? ArrowUp : row.trend === "deteriorating" ? ArrowDown : ArrowRight;
  const arrowColor = row.trend === "improving" ? C.green : row.trend === "deteriorating" ? C.red : C.muted;

  return (
    <div className="flex items-center gap-2 border-b py-1.5 last:border-b-0" style={{ borderColor: C.borderSoft }}>
      <Icon size={14} strokeWidth={1.5} className="shrink-0" style={{ color: C.soft }} />
      <span className="min-w-0 flex-1 truncate" style={{ color: C.text }}>
        {label} <span style={{ color: C.muted }}>({phase})</span>
      </span>
      <span className="shrink-0 tabular-nums" style={{ color: C.text }}>{fmtNumber(row.score)}</span>
      <TrendIcon size={14} strokeWidth={2.5} className="shrink-0" style={{ color: arrowColor }} />
    </div>
  );
}

function categoryIcon(cat: string) {
  switch (cat) {
    case "housing":
      return Home;
    case "orders":
      return Package;
    case "income_sales":
      return ShoppingCart;
    case "employment":
      return Users;
    case "inflation":
      return TrendingUp;
    default:
      return LineChart;
  }
}

export function NavigatorYieldCurveMini({
  snapshot,
  history,
  fillContainer = false,
}: {
  snapshot: YieldCurveSnapshot | null | undefined;
  history: YieldCurveSnapshot[] | null | undefined;
  fillContainer?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    if (!snapshot?.points?.length) return [];
    return YIELD_MATURITY_ORDER.map((m) => {
      const point = snapshot.points.find((p) => p.maturity === m);
      const row: { maturity: string; current: number | null; hist: (number | null)[] } = {
        maturity: m,
        current: point?.nominal_yield ?? null,
        hist: [],
      };
      history?.forEach((snap) => {
        const hp = snap.points.find((p) => p.maturity === m);
        row.hist.push(hp?.nominal_yield ?? null);
      });
      return row;
    }).filter((d) => d.current !== null);
  }, [snapshot, history]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length === 0) return;

    const paint = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const css = window.getComputedStyle(canvas);
      const themeText = css.getPropertyValue("--nd-text").trim() || "#d7d0c7";
      const themeBorder = css.getPropertyValue("--nd-border").trim() || "#2f3842";
      const themeBorderSoft = css.getPropertyValue("--nd-border-soft").trim() || "#232b33";
      const themeRed = css.getPropertyValue("--nd-red").trim() || "#d45d72";

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const bw = Math.max(1, Math.floor(rect.width * dpr));
      const bh = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = bw;
      canvas.height = bh;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const w = rect.width;
      const h = rect.height;
      const padL = 42;
      const padR = 18;
      const padT = 10;
      const padB = 30;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      let yMin = Infinity;
      let yMax = -Infinity;
      for (const d of chartData) {
        if (d.current != null) {
          yMin = Math.min(yMin, d.current);
          yMax = Math.max(yMax, d.current);
        }
        for (const v of d.hist) {
          if (v != null) {
            yMin = Math.min(yMin, v);
            yMax = Math.max(yMax, v);
          }
        }
      }
      const yPad = (yMax - yMin) * 0.14 || 0.35;
      yMin -= yPad;
      yMax += yPad;

      const xOf = (i: number) => padL + (i / Math.max(1, chartData.length - 1)) * plotW;
      const yOf = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

      ctx.clearRect(0, 0, w, h);

      const yTickCount = 5;
      const yTicks = Array.from({ length: yTickCount }, (_, idx) => {
        const ratio = idx / Math.max(1, yTickCount - 1);
        const value = yMax - (yMax - yMin) * ratio;
        return { value, y: padT + plotH * ratio };
      });

      ctx.strokeStyle = themeBorderSoft;
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = 1;
      for (const tick of yTicks) {
        ctx.beginPath();
        ctx.moveTo(padL, tick.y);
        ctx.lineTo(w - padR, tick.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = themeBorder;
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, h - padB);
      ctx.lineTo(w - padR, h - padB);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = themeText;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const tick of yTicks) {
        ctx.fillText(`${tick.value.toFixed(1)}%`, padL - 6, tick.y);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i < chartData.length; i += 1) {
        const x = Math.min(w - padR - 2, Math.max(padL + 2, xOf(i)));
        ctx.beginPath();
        ctx.strokeStyle = themeBorder;
        ctx.globalAlpha = 0.82;
        ctx.moveTo(x, h - padB);
        ctx.lineTo(x, h - padB + 4);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillText(chartData[i].maturity, x, h - padB + 6);
      }

      const drawCurve = (
        values: (number | null)[],
        color: string,
        lineW: number,
        opacity: number,
        dash: number[],
        withDots = false,
      ) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        ctx.globalAlpha = opacity;
        ctx.setLineDash(dash);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < values.length; i += 1) {
          const v = values[i];
          if (v == null) continue;
          const x = Math.round(xOf(i) * 10) / 10;
          const y = Math.round(yOf(v) * 10) / 10;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (withDots) {
          ctx.fillStyle = color;
          for (let i = 0; i < values.length; i += 1) {
            const v = values[i];
            if (v == null) continue;
            const x = Math.round(xOf(i) * 10) / 10;
            const y = Math.round(yOf(v) * 10) / 10;
            ctx.beginPath();
            ctx.arc(x, y, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.globalAlpha = 1;
      };

      const histLen = history?.length ?? 0;
      for (let hi = histLen - 1; hi >= 0; hi -= 1) {
        const vals = chartData.map((d) => d.hist[hi] ?? null);
        const style = YIELD_HISTORY_STYLE[hi];
        if (!style) continue;
        const stroke = style.key === "m3"
          ? themeRed
          : style.key === "m6"
            ? YIELD_CURVE_SERIES_COLORS.m6
            : YIELD_CURVE_SERIES_COLORS.y1;
        drawCurve(vals, stroke, 1.45, style.opacity, [...style.dash]);
      }

      const currentVals = chartData.map((d) => d.current);
      drawCurve(currentVals, YIELD_CURVE_SERIES_COLORS.now, 2.35, 1, [], true);
    };

    paint();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => paint()) : null;
    const el = wrapRef.current;
    if (ro && el) ro.observe(el);
    return () => ro?.disconnect();
  }, [chartData, history]);

  if (!snapshot?.points?.length) {
    return (
      <div className={`flex items-center justify-center text-[11px] ${fillContainer ? "min-h-[80px] flex-1" : "h-[118px]"}`} style={{ color: C.muted }}>
        No yield data
      </div>
    );
  }

  const outerCls = fillContainer
    ? "flex h-full min-h-0 w-full max-w-full min-w-0 flex-1 flex-col overflow-hidden"
    : "flex w-full max-w-full min-w-0 shrink-0 flex-col";
  const chartWrapCls = fillContainer
    ? "min-h-[72px] w-full min-w-0 flex-1 overflow-hidden"
    : "h-[118px] w-full min-w-0 shrink-0 overflow-hidden";

  return (
    <div className={outerCls}>
      <div ref={wrapRef} className={chartWrapCls}>
        <canvas ref={canvasRef} className="block h-full w-full max-w-full min-w-0" aria-label="Yield curve comparison" />
      </div>
      <div className="mt-1 flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-0.5 text-[10px] uppercase tracking-[0.06em]" style={{ color: C.soft }}>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded-full" style={{ background: YIELD_CURVE_SERIES_COLORS.now }} />Now</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded-full" style={{ background: C.red }} />3m</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded-full" style={{ background: YIELD_CURVE_SERIES_COLORS.m6 }} />6m</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 rounded-full" style={{ background: YIELD_CURVE_SERIES_COLORS.y1 }} />1y</span>
      </div>
    </div>
  );
}

export function formatCurvePatternLabel(pattern: string | null | undefined) {
  if (!pattern?.trim()) return "—";
  return pattern.replace(/_/g, " ").toUpperCase();
}

export function formatSpread2y10y(snapshot: YieldCurveSnapshot | null | undefined) {
  const spread = snapshot?.spreads?.find((x) => x.name === "2Y10Y");
  let value = spread?.value ?? null;
  if (value == null && snapshot?.points?.length) {
    const y2 = snapshot.points.find((p) => p.maturity === "2Y")?.nominal_yield ?? null;
    const y10 = snapshot.points.find((p) => p.maturity === "10Y")?.nominal_yield ?? null;
    if (y2 != null && y10 != null) value = (y10 - y2) * 100;
  }
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}bp`;
}

export function formatRealYield10y(snapshot: YieldCurveSnapshot | null | undefined) {
  const spread = snapshot?.spreads?.find((x) => x.name === "10Y_REAL_YIELD");
  if (spread != null) return `${spread.value.toFixed(2)}%`;
  const tips = snapshot?.points?.find((p) => p.maturity === "10Y")?.tips_yield ?? null;
  if (tips == null) return "—";
  return `${tips.toFixed(2)}%`;
}

export function fmtNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toFixed(digits);
}

export function fmtPct(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(digits)}%`;
}

export function regimeAccent(label: string) {
  const normalized = label.toUpperCase();
  if (normalized.includes("RISK ON") || normalized.includes("Q1")) return C.green;
  if (normalized.includes("GROWTH") || normalized.includes("Q2")) return C.blue;
  if (normalized.includes("VALUE") || normalized.includes("Q3")) return C.yellow;
  if (normalized.includes("RISK OFF") || normalized.includes("Q4")) return C.red;
  return C.soft;
}

export function compactRegimeLabel(label: string) {
  const normalized = label.toUpperCase();
  if (normalized.includes("RISK ON") || normalized.includes("Q1_GOLDILOCKS")) return "RISK ON";
  if (normalized.includes("GROWTH") || normalized.includes("Q2_REFLATION")) return "GROWTH";
  if (normalized.includes("VALUE") || normalized.includes("Q3_OVERHEATING")) return "VALUE";
  if (normalized.includes("RISK OFF") || normalized.includes("Q4_STAGFLATION")) return "RISK OFF";
  return label.split("(")[0].trim().toUpperCase();
}

function formatAxisValue(value: number) {
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  const rounded = Math.abs(normalized) >= 10 ? normalized.toFixed(0) : normalized.toFixed(1);
  return rounded.replace(/\.0$/, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function badgeText(signal: CrossAssetSignal["signal"]) {
  if (signal === "bullish") return "BULLISH";
  if (signal === "bearish") return "BEARISH";
  return "INVERTED";
}

function signalColor(signal: CrossAssetSignal["signal"]) {
  if (signal === "bullish") return C.green;
  if (signal === "bearish") return C.red;
  return C.blue;
}

function badgeColor(signal: CrossAssetSignal["signal"]) {
  if (signal === "bullish") return "rgba(50, 103, 61, 0.68)";
  if (signal === "bearish") return "rgba(104, 46, 58, 0.68)";
  return "rgba(49, 67, 105, 0.72)";
}

function badgeTextColor(signal: CrossAssetSignal["signal"]) {
  if (signal === "bullish") return "#d4f0d2";
  if (signal === "bearish") return "#ffc5cb";
  return "#d5e3ff";
}

function formatTick(value: number, format: "number" | "percent" | "basis_points") {
  if (format === "basis_points") return `${Math.round(value)}`;
  if (format === "percent") return `${value.toFixed(0)}`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDelta(value: number | null, suffix = "") {
  if (value == null || Number.isNaN(value)) return { value: "N/A", color: C.soft };
  const sign = value > 0 ? "+" : "";
  const color = value > 0 ? C.red : value < 0 ? C.green : C.soft;
  return { value: `${sign}${value.toFixed(1)}${suffix}`, color };
}

function formatDeltaByFormat(value: number | null, format: "number" | "percent" | "basis_points") {
  if (value == null || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  if (format === "basis_points") return `${sign}${value.toFixed(0)}bp`;
  if (format === "percent") return `${sign}${value.toFixed(1)}%`;
  return `${sign}${value.toFixed(2)}`;
}

function pointColorFromPalette(
  ratio: number,
  palette?: readonly [string, string, string],
  higherIsWorse = false,
) {
  const safe = clamp(ratio, 0, 1);
  const defaultPalette = higherIsWorse
    ? (["#6db77a", "#c9b55d", "#c66b74"] as const)
    : (["#c66b74", "#c9b55d", "#6db77a"] as const);
  const [c1, c2, c3] = palette ?? defaultPalette;
  if (safe <= 0.5) return lerpHex(c1, c2, safe / 0.5);
  return lerpHex(c2, c3, (safe - 0.5) / 0.5);
}

function lerpHex(from: string, to: string, t: number) {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    const value = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    };
  };
  const a = parse(from);
  const b = parse(to);
  const safeT = clamp(t, 0, 1);
  const r = Math.round(a.r + (b.r - a.r) * safeT);
  const g = Math.round(a.g + (b.g - a.g) * safeT);
  const bl = Math.round(a.b + (b.b - a.b) * safeT);
  return `rgb(${r}, ${g}, ${bl})`;
}

function series(seedKey: string, signal: CrossAssetSignal["signal"], points: number) {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i += 1) seed = (seed * 31 + seedKey.charCodeAt(i)) % 9973;
  const drift = signal === "bullish" ? 1.45 : signal === "bearish" ? -1.45 : 0;
  const pulse = signal === "bullish" ? 4.8 : signal === "bearish" ? -4.8 : 3.4;
  let y = 50 + ((seed % 11) - 5);
  const out: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const noise = (((seed + i * 13) % 17) - 8) * 0.95;
    const zigzag = i % 2 === 0 ? pulse : -pulse;
    y = clamp(y + drift + noise + zigzag, 10, 90);
    out.push(y);
  }
  return out;
}
