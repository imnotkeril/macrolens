"use client";

import type { FactorAllocation, SectorAllocation, TradingRecommendation } from "@/types";
import {
  compactIdeaThesis,
  expandTilt,
  extractLeg,
  normalizeTiltLabel,
  summarizeLegs,
  tiltColor,
} from "@/features/dashboard/utils/snapshotUtils";

export type SnapshotDetailKind = "factors" | "sectors" | "ideas";

type ModalColors = {
  panel: string;
  panelSoft: string;
  border: string;
  borderSoft: string;
  text: string;
  soft: string;
  muted: string;
};

type SnapshotDetailModalProps = {
  kind: SnapshotDetailKind;
  onClose: () => void;
  factors: FactorAllocation[];
  sectors: SectorAllocation[];
  ideas: TradingRecommendation[];
  fallbackFactors: Array<[string, string, string]>;
  sectorTickerMap: Record<string, string>;
  colors: ModalColors;
};

export function SnapshotDetailModal({
  kind,
  onClose,
  factors,
  sectors,
  ideas,
  fallbackFactors,
  sectorTickerMap,
  colors,
}: SnapshotDetailModalProps) {
  const titleByKind: Record<SnapshotDetailKind, string> = {
    factors: "Full Factor Tilts",
    sectors: "Full Sector Allocation",
    ideas: "Trading Ideas Details",
  };
  const subtitleByKind: Record<SnapshotDetailKind, string> = {
    factors: "Factor tilt summary with tickers and rationale.",
    sectors: "Sector weights with rationale for the current macro phase.",
    ideas: "Trading ideas with thesis and executable legs.",
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-5">
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0"
        style={{ background: "rgba(4,8,12,0.76)" }}
        onClick={onClose}
      />
      <div
        className="relative w-[min(1180px,92vw)] max-h-[84vh] overflow-auto rounded-[4px] border p-5"
        style={{ borderColor: colors.border, background: colors.panel, boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 28px 60px rgba(0,0,0,0.42)" }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[16px] uppercase tracking-[0.09em]">{titleByKind[kind]}</div>
            <div className="mt-1 text-[12px] uppercase tracking-[0.05em]" style={{ color: colors.soft }}>{subtitleByKind[kind]}</div>
          </div>
          <button
            type="button"
            className="rounded-[2px] border px-2 py-1 text-[11px] uppercase tracking-[0.08em] transition-opacity hover:opacity-85"
            style={{ borderColor: colors.borderSoft, color: colors.text, background: colors.panelSoft }}
            onClick={onClose}
          >
            Close (Esc)
          </button>
        </div>

        {kind === "factors" ? (
          <div className="grid gap-1">
            <div
              className="grid grid-cols-[220px_110px_330px_minmax(0,1fr)] gap-4 border-b pb-2 text-[11px] uppercase tracking-[0.06em]"
              style={{ borderColor: colors.border, color: colors.muted }}
            >
              <span>Factor</span>
              <span>Tilt</span>
              <span>Tickers</span>
              <span>Rationale</span>
            </div>
            {(factors.length ? factors : fallbackFactors.map(([factor, weight]) => ({
              factor,
              weight: expandTilt(weight) as "overweight" | "neutral" | "underweight",
              description: "Methodology fallback row",
              tickers: [],
            }))).map((row) => (
              <div key={`factor-modal-${row.factor}`} className="grid grid-cols-[220px_110px_330px_minmax(0,1fr)] gap-4 border-b py-3" style={{ borderColor: colors.border }}>
                <span className="text-[15px]" style={{ color: colors.text }}>{row.factor}</span>
                <span className="text-[13px] uppercase" style={{ color: tiltColor(row.weight) }}>{normalizeTiltLabel(row.weight)}</span>
                <span className="text-[13px] uppercase tracking-[0.03em]" style={{ color: colors.soft }}>{(row.tickers?.length ? row.tickers.join(", ") : "No ticker basket")}</span>
                <span className="text-[13px]" style={{ color: colors.soft }}>{row.description}</span>
              </div>
            ))}
          </div>
        ) : null}

        {kind === "sectors" ? (
          <div className="grid gap-1">
            <div
              className="grid grid-cols-[220px_110px_250px_minmax(0,1fr)] gap-4 border-b pb-2 text-[11px] uppercase tracking-[0.06em]"
              style={{ borderColor: colors.border, color: colors.muted }}
            >
              <span>Sector</span>
              <span>Tilt</span>
              <span>Tickers</span>
              <span>Rationale</span>
            </div>
            {sectors.map((row) => (
              <div key={`sector-modal-${row.sector}`} className="grid grid-cols-[220px_110px_250px_minmax(0,1fr)] gap-4 border-b py-3" style={{ borderColor: colors.border }}>
                <span className="text-[15px]" style={{ color: colors.text }}>{row.sector}</span>
                <span className="text-[13px] uppercase" style={{ color: tiltColor(row.weight) }}>{normalizeTiltLabel(row.weight)}</span>
                <span className="text-[13px] uppercase tracking-[0.03em]" style={{ color: colors.soft }}>{sectorTickerMap[row.sector] ?? "ETF basket N/A"}</span>
                <span className="text-[13px]" style={{ color: colors.soft }}>{row.rationale}</span>
              </div>
            ))}
          </div>
        ) : null}

        {kind === "ideas" ? (
          <div className="grid gap-1">
            <div
              className="grid grid-cols-[320px_minmax(0,1fr)_350px] gap-4 border-b pb-2 text-[11px] uppercase tracking-[0.06em]"
              style={{ borderColor: colors.border, color: colors.muted }}
            >
              <span>Category</span>
              <span>Thesis</span>
              <span>Legs</span>
            </div>
            {(ideas.length ? ideas : []).map((row) => (
              <div key={`idea-modal-${row.name}`} className="grid grid-cols-[320px_minmax(0,1fr)_350px] gap-4 border-b py-3" style={{ borderColor: colors.border }}>
                <span className="text-[15px]" style={{ color: colors.text }}>{row.name}</span>
                <span className="text-[13px]" style={{ color: colors.soft }}>{compactIdeaThesis(row.description || row.rationale || "")}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {extractLeg(row.legs, "long") ? <LegTag label={`LONG ${extractLeg(row.legs, "long")}`} tone="long" /> : null}
                  {extractLeg(row.legs, "short") ? <LegTag label={`SHORT ${extractLeg(row.legs, "short")}`} tone="short" /> : null}
                  {!extractLeg(row.legs, "long") && !extractLeg(row.legs, "short") ? <LegTag label={summarizeLegs(row.legs)} tone="neutral" /> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
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
