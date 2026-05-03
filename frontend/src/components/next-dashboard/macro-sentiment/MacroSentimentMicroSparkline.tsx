"use client";

type Props = {
  values: number[];
  stroke: string;
  height?: number;
};

export function MacroSentimentMicroSparkline({ values, stroke, height = 36 }: Props) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) {
    return <div className="w-full opacity-30" style={{ height }} />;
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const pad = Math.max(1e-6, (max - min) * 0.08);
  const lo = min - pad;
  const hi = max + pad;
  const w = 1000;
  const h = height - 4;
  const path = pts
    .map((v, i) => {
      const x = (i / Math.max(1, pts.length - 1)) * w;
      const y = h - ((v - lo) / (hi - lo)) * h + 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      className="block min-h-0 min-w-0 w-full"
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
