"use client";

import {
  compactIdeaThesis,
  extractLeg,
  normalizeTiltLabel,
  summarizeLegs,
  tiltArrow,
} from "@/features/dashboard/utils/snapshotUtils";

type Palette = {
  panel: string;
  panelSoft: string;
  border: string;
  borderSoft: string;
  text: string;
  soft: string;
  muted: string;
};

type TiltRow = { name: string; tilt: string; color: string };
type GeoRow = { label: string; raw: string; color: string; weight: number };
type IdeaRow = { name: string; trade_type: string; legs: string; description?: string; rationale?: string };

type Props = {
  colors: Palette;
  factors: TiltRow[];
  sectors: TiltRow[];
  alloc: Array<{ label: string; value: number; color: string }>;
  geographyRows: GeoRow[];
  dmGeo: GeoRow | null;
  emGeo: GeoRow | null;
  recs: IdeaRow[];
  onOpenFactors: () => void;
  onOpenSectors: () => void;
  onOpenIdeas: () => void;
};

function AssetDonut({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const total = Math.max(1, items.reduce((sum, i) => sum + Math.max(0, i.value), 0));
  let acc = 0;
  const slices = items.map((i) => {
    const start = (acc / total) * 360;
    acc += Math.max(0, i.value);
    return `${i.color} ${start}deg ${(acc / total) * 360}deg`;
  }).join(", ");
  return (
    <div
      className="h-[112px] w-[112px] min-w-[112px] shrink-0 rounded-full"
      style={{ background: `conic-gradient(${slices})`, padding: 24, aspectRatio: "1 / 1" }}
    >
      <div className="h-full w-full rounded-full" style={{ background: "var(--nd-panel)" }} />
    </div>
  );
}

function SnapshotTiltTable({
  title,
  rows,
  showSignals = false,
}: {
  title: string;
  rows: TiltRow[];
  showSignals?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-center uppercase tracking-[0.08em]">{title}</div>
      {rows.map((row) => (
        <div key={`${row.name}-${row.tilt}`} className="grid grid-cols-[1fr_auto] items-center gap-2 py-[2px]">
          <span className="truncate">{row.name}</span>
          <span className="inline-flex min-w-[34px] items-center justify-end gap-1 tabular-nums" style={{ color: row.color }}>
            {showSignals ? <span>{tiltArrow(row.tilt)}</span> : null}
            <span>{normalizeTiltLabel(row.tilt)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function GeographySplitBar({
  rows,
  borderColor,
}: {
  rows: GeoRow[];
  borderColor: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  const fallbackDenominator = Math.max(1, rows.length);
  return (
    <div className="mb-3 flex h-5 overflow-hidden rounded-[2px] border" style={{ borderColor, background: "var(--nd-panel-soft)" }}>
      {rows.map((row, index) => {
        const ratio = total > 0 ? row.weight / total : 1 / fallbackDenominator;
        return (
          <div
            key={`geo-segment-${row.label}`}
            className="relative h-full"
            style={{
              width: `${ratio * 100}%`,
              background: row.color,
              opacity: index % 2 === 0 ? 0.8 : 0.76,
            }}
          />
        );
      })}
    </div>
  );
}

function LegTag({ label, tone }: { label: string; tone: "long" | "short" | "neutral" }) {
  const color =
    tone === "long"
      ? "#c2f2c9"
      : tone === "short"
        ? "#ffd4dc"
        : "#d8d2c7";
  const background =
    tone === "long"
      ? "rgba(114,173,102,0.2)"
      : tone === "short"
        ? "rgba(212,93,114,0.2)"
        : "rgba(126,126,120,0.22)";
  const borderColor =
    tone === "long"
      ? "rgba(114,173,102,0.35)"
      : tone === "short"
        ? "rgba(212,93,114,0.35)"
        : "rgba(148,148,140,0.34)";
  return (
    <span
      className="inline-flex h-5 items-center rounded-[2px] px-1.5 text-[10px] uppercase tracking-[0.03em]"
      style={{
        color,
        background,
        border: `1px solid ${borderColor}`,
      }}
    >
      {label}
    </span>
  );
}

function SnapshotTradingIdeas({ rows, borderColor, textColor }: { rows: IdeaRow[]; borderColor: string; textColor: string }) {
  return (
    <div>
      <div
        className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,1.2fr)] gap-2 border-b pb-1 text-[10px] uppercase tracking-[0.08em]"
        style={{ borderColor, color: "var(--nd-muted)" }}
      >
        <span>Category</span>
        <span>Thesis</span>
        <span className="text-right">Legs</span>
      </div>
      {rows.map((row) => {
        const longLeg = extractLeg(row.legs, "long");
        const shortLeg = extractLeg(row.legs, "short");
        return (
          <div
            key={`${row.name}-${row.trade_type}`}
            className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,1.2fr)] items-center gap-2 border-b py-1.5"
            style={{ borderColor }}
          >
            <span className="truncate" style={{ color: textColor }}>{row.name}</span>
            <span className="truncate text-[11px]" title={row.description ?? row.rationale ?? ""}>{compactIdeaThesis(row.description ?? row.rationale ?? "")}</span>
            <div className="flex items-center justify-end gap-1.5">
              {longLeg ? <LegTag label={`LONG ${longLeg}`} tone="long" /> : <LegTag label={summarizeLegs(row.legs)} tone="neutral" />}
              {shortLeg ? <LegTag label={`SHORT ${shortLeg}`} tone="short" /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardRecommendationsSection({
  colors,
  factors,
  sectors,
  alloc,
  geographyRows,
  dmGeo,
  emGeo,
  recs,
  onOpenFactors,
  onOpenSectors,
  onOpenIdeas,
}: Props) {
  return (
    <div
      className="nd-dashboard-panel print:break-inside-avoid"
      style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: "4px", padding: "20px 22px", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.012)", minHeight: 0, overflow: "hidden", height: 280 }}
    >
      <div className="mb-1 text-[18px] uppercase leading-none tracking-[0.08em]">Recommendations Snapshot</div>
      <div className="mt-3 grid grid-cols-[0.82fr_0.95fr_1.24fr_2.84fr] gap-0 text-[12px]" style={{ color: colors.soft }}>
        <div className="flex h-full flex-col pr-3">
          <SnapshotTiltTable title="Factor Tilts" rows={factors} showSignals />
          <button type="button" className="mt-auto pt-3 text-[11px] uppercase tracking-[0.05em] transition-opacity hover:opacity-85" style={{ color: colors.text }} onClick={onOpenFactors}>
            View Full Factor Tilts {"->"}
          </button>
        </div>
        <div className="flex h-full flex-col border-l pl-3 pr-3" style={{ borderColor: colors.borderSoft }}>
          <SnapshotTiltTable title="Sector Allocation" rows={sectors} />
          <button type="button" className="mt-auto pt-3 text-[11px] uppercase tracking-[0.05em] transition-opacity hover:opacity-85" style={{ color: colors.text }} onClick={onOpenSectors}>
            View Full Allocation {"->"}
          </button>
        </div>
        <div className="border-l pl-4 pr-3" style={{ borderColor: colors.borderSoft }}>
          <div className="mb-2 text-center uppercase tracking-[0.08em]">Asset Allocation</div>
          <div className="flex items-start gap-1.5">
            <AssetDonut items={alloc} />
            <div className="w-[126px] space-y-0.5">
              {alloc.map((d) => (
                <div key={d.label} className="grid grid-cols-[1fr_auto] items-center gap-0.5 py-[1px]">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: d.color }} />
                    {d.label}
                  </div>
                  <span className="tabular-nums text-right" style={{ color: colors.text }}>{Math.round(d.value)}%</span>
                </div>
              ))}
            </div>
          </div>
          {geographyRows.length ? (
            <div className="mt-3 border-t pt-2" style={{ borderColor: colors.borderSoft }}>
              <GeographySplitBar rows={geographyRows} borderColor={colors.border} />
              <div className="mt-1 grid grid-cols-2 text-[11px]">
                <div className="flex items-center justify-center gap-1.5 py-1">
                  <span className="uppercase">{dmGeo?.label ?? "DM"}</span>
                  <span className="tabular-nums uppercase" style={{ color: dmGeo?.color ?? colors.soft }}>{dmGeo?.raw ?? "neutral"}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 border-l py-1" style={{ borderColor: colors.borderSoft }}>
                  <span className="uppercase">{emGeo?.label ?? "EM"}</span>
                  <span className="tabular-nums uppercase" style={{ color: emGeo?.color ?? colors.soft }}>{emGeo?.raw ?? "neutral"}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex h-full flex-col border-l pl-4 pr-1" style={{ borderColor: colors.borderSoft }}>
          <div className="mb-2 text-center uppercase tracking-[0.08em]">Trading Ideas (Examples)</div>
          {recs.length ? (
            <SnapshotTradingIdeas rows={recs} borderColor={colors.border} textColor={colors.text} />
          ) : (
            <div className="py-2 text-[11px] uppercase tracking-[0.06em]" style={{ color: colors.muted }}>
              No trading ideas
            </div>
          )}
          <button type="button" className="mt-auto pt-3 text-[11px] uppercase tracking-[0.05em] transition-opacity hover:opacity-85" style={{ color: colors.text }} onClick={onOpenIdeas}>
            View All Ideas {"->"}
          </button>
        </div>
      </div>
    </div>
  );
}
