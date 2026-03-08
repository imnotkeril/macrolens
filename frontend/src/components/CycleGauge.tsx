"use client";

import { cn } from "@/lib/utils";

interface Props {
  score: number;
  phase: string;
  phaseLabel: string;
  size?: "default" | "large";
}

const PHASE_COLORS: Record<string, string> = {
  expansion: "#10b981",
  recovery: "#3b82f6",
  slowdown: "#f59e0b",
  contraction: "#ef4444",
};

export function CycleGauge({ score, phase, phaseLabel, size = "default" }: Props) {
  const color = PHASE_COLORS[phase] ?? "#6b7280";
  // Map score (-100..+100) to angle (-135..+135 degrees)
  const angle = (score / 100) * 135;
  const rad = ((angle - 90) * Math.PI) / 180;

  const isLarge = size === "large";
  const cx = 120;
  const cy = 120;
  const r = 90;
  const svgW = isLarge ? 320 : 240;
  const svgH = isLarge ? 213 : 160;

  // Tick marks for the gauge arc
  const ticks = [-100, -60, -20, 0, 20, 60, 100];

  // Arc path helper
  const arcPath = (startAngle: number, endAngle: number, radius: number) => {
    const s = ((startAngle - 90) * Math.PI) / 180;
    const e = ((endAngle - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(s);
    const y1 = cy + radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e);
    const y2 = cy + radius * Math.sin(e);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div className={cn("card flex flex-col", isLarge && "min-h-[360px] h-full")}>
      <div className="card-header">Cycle Phase Indicator</div>
      <div className={cn("flex flex-col items-center py-4", isLarge && "flex-1 justify-center")}>
        <svg width={svgW} height={svgH} viewBox="0 0 240 160" className={isLarge ? "max-h-[280px] w-full" : ""}>
          {/* Background arc segments */}
          <path d={arcPath(-135, -67.5, r)} fill="none" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.2" />
          <path d={arcPath(-67.5, -27, r)} fill="none" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" opacity="0.2" />
          <path d={arcPath(-27, 0, r)} fill="none" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" opacity="0.15" />
          <path d={arcPath(0, 27, r)} fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" opacity="0.15" />
          <path d={arcPath(27, 67.5, r)} fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" opacity="0.2" />
          <path d={arcPath(67.5, 135, r)} fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" opacity="0.2" />

          {/* Active arc to current position */}
          {score !== 0 && (
            <path
              d={arcPath(score > 0 ? 0 : angle, score > 0 ? angle : 0, r)}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.8"
            />
          )}

          {/* Tick labels */}
          {ticks.map((t) => {
            const a = ((t / 100) * 135 - 90) * Math.PI / 180;
            const lx = cx + (r + 16) * Math.cos(a);
            const ly = cy + (r + 16) * Math.sin(a);
            return (
              <text key={t} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                className="fill-text-muted" fontSize="9" fontWeight="300">
                {t > 0 ? `+${t}` : t}
              </text>
            );
          })}

          {/* Needle */}
          <line
            x1={cx} y1={cy}
            x2={cx + (r - 12) * Math.cos(rad)}
            y2={cy + (r - 12) * Math.sin(rad)}
            stroke={color} strokeWidth="3" strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="5" fill={color} />

          {/* Center label */}
          <text x={cx} y={cy + 28} textAnchor="middle" fontSize="28" fontWeight="200"
            fill={color} className="tabular-nums">
            {score >= 0 ? "+" : ""}{score.toFixed(0)}
          </text>
        </svg>

        <div className="mt-2 text-center">
          <div className="text-lg font-light tracking-wide" style={{ color }}>
            {phaseLabel}
          </div>
          <div className="mt-1 flex items-center justify-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-accent-red" /> Contraction
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-accent-amber" /> Slowdown
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-accent-blue" /> Recovery
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-accent-green" /> Expansion
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
