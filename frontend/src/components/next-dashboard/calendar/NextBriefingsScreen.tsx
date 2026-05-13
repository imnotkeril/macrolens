"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { NextCalendarArchiveDropdown } from "@/components/next-dashboard/calendar/NextCalendarArchiveDropdown";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { BRIEFING_ARCHIVE_DAYS, getEveningBriefDemo, getMorningBriefDemo } from "@/components/next-dashboard/calendar/briefingDemoData";
import type {
  BeatMiss,
  BriefingImportance,
  EveningBriefData,
  MorningBriefData,
} from "@/components/next-dashboard/calendar/briefingTypes";

type BriefEdition = "morning" | "evening";

function importanceColor(imp: BriefingImportance, palette: { high: string; mid: string; low: string }) {
  if (imp === "high") return palette.high;
  if (imp === "medium") return palette.mid;
  return palette.low;
}

function formatOvernightChange(label: string, changePct: number, green: string, red: string) {
  const isBps = /yield|UST|\b10Y\b/i.test(label);
  const sign = changePct >= 0 ? "+" : "";
  const color = changePct >= 0 ? green : red;
  if (isBps) {
    return { text: `${sign}${changePct.toFixed(1)} bps`, color };
  }
  return { text: `${sign}${changePct.toFixed(2)}%`, color };
}

function beatMissLabel(b: BeatMiss): string {
  if (b === "beat") return "BEAT";
  if (b === "miss") return "MISS";
  if (b === "in-line") return "IN-LINE";
  return "—";
}

function beatMissStyle(
  b: BeatMiss,
  colors: { green: string; red: string; yellow: string; muted: string },
): { border: string; fg: string } {
  if (b === "beat") return { border: colors.green, fg: colors.green };
  if (b === "miss") return { border: colors.red, fg: colors.red };
  if (b === "in-line") return { border: colors.yellow, fg: colors.yellow };
  return { border: colors.muted, fg: colors.muted };
}

function DirectionCell({ dir }: { dir: "up" | "down" | "flat" }) {
  if (dir === "up") return <ArrowUp className="inline h-3.5 w-3.5" strokeWidth={2.5} />;
  if (dir === "down") return <ArrowDown className="inline h-3.5 w-3.5" strokeWidth={2.5} />;
  return <Minus className="inline h-3.5 w-3.5" strokeWidth={2.5} />;
}

function KeyEventsTable({
  rows,
  colors,
  importancePalette,
}: {
  rows: MorningBriefData["keyEvents"];
  colors: ReturnType<typeof useNextShellTheme>["colors"];
  importancePalette: { high: string; mid: string; low: string };
}) {
  const th = "text-left text-[10px] uppercase tracking-[0.1em] pb-2 pr-3";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[12px] tabular-nums">
        <thead>
          <tr style={{ color: colors.muted }}>
            <th className={th} style={{ width: 56 }}>
              {" "}
            </th>
            <th className={th}>Time</th>
            <th className={th}>Ccy</th>
            <th className={th}>Event</th>
            <th className={th}>Est</th>
            <th className={th}>Prev</th>
            <th className={th}>Act</th>
            <th className={th}>Beat/Miss</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const dot = importanceColor(r.importance, importancePalette);
            const bm = beatMissStyle(r.beatMiss, colors);
            return (
              <tr key={`${r.time}-${r.event}`} className="border-t" style={{ borderColor: colors.borderSoft }}>
                <td className="py-2 pr-2 align-middle">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: dot }} />
                </td>
                <td className="py-2 pr-3 align-middle">{r.time}</td>
                <td className="py-2 pr-3 align-middle">{r.currency}</td>
                <td className="py-2 pr-3 align-middle" style={{ color: colors.text }}>
                  {r.event}
                </td>
                <td className="py-2 pr-3 align-middle">{r.est}</td>
                <td className="py-2 pr-3 align-middle">{r.prev}</td>
                <td className="py-2 pr-3 align-middle">{r.act}</td>
                <td className="py-2 align-middle">
                  {r.beatMiss === "pending" ? (
                    <span style={{ color: colors.muted }}>—</span>
                  ) : (
                    <span
                      className="inline-block rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ borderColor: bm.border, color: bm.fg }}
                    >
                      {beatMissLabel(r.beatMiss)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MarketSnapshotGrid({
  items,
  colors,
}: {
  items: MorningBriefData["marketSnapshot"];
  colors: ReturnType<typeof useNextShellTheme>["colors"];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((s) => {
        const up = s.changePct >= 0;
        const fg = up ? colors.green : colors.red;
        const sign = up ? "+" : "";
        return (
          <div
            key={s.symbol}
            className="rounded border px-2.5 py-2"
            style={{ borderColor: colors.borderSoft, background: colors.panelSoft }}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: colors.text }}>
                {s.symbol}
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: fg }}>
                {sign}
                {s.changePct.toFixed(2)}%
              </span>
            </div>
            <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: colors.muted }}>
              {s.name}
            </div>
            <div className="mt-1 text-[13px] tabular-nums" style={{ color: colors.text }}>
              {s.price}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MorningPanels({
  data,
  surface,
  colors,
  importancePalette,
}: {
  data: MorningBriefData;
  surface: ReturnType<typeof nextPanelSurfaceStyle>;
  colors: ReturnType<typeof useNextShellTheme>["colors"];
  importancePalette: { high: string; mid: string; low: string };
}) {
  const regimeUp = data.regimeLabel.includes("ON") || data.regimeLabel.includes("GROWTH");
  return (
    <>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div style={surface}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
              {data.briefDate}
            </span>
            <span
              className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ borderColor: colors.yellow, color: colors.yellow }}
            >
              Morning
            </span>
          </div>
          <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight" style={{ color: colors.text }}>
            {data.headline}
          </h1>
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Executive summary
          </div>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: colors.soft }}>
            {data.executiveSummary}
          </p>
        </div>
        <div style={surface}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Key events
          </div>
          <div className="mt-3">
            <KeyEventsTable rows={data.keyEvents} colors={colors} importancePalette={importancePalette} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div style={surface}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Market context
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[28px] font-bold leading-none" style={{ color: regimeUp ? colors.green : colors.red }}>
                {data.regimeLabel}
              </div>
              <div className="mt-1 text-[12px] tabular-nums" style={{ color: colors.soft }}>
                Score {data.regimeScore >= 0 ? "+" : ""}
                {data.regimeScore.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
            Overnight moves
          </div>
          <ul className="mt-2 space-y-1.5 text-[12px]">
            {data.overnightMoves.map((m) => {
              const fmt = formatOvernightChange(m.label, m.changePct, colors.green, colors.red);
              return (
                <li key={m.label} className="flex justify-between gap-3 border-b border-dashed pb-1.5 last:border-0" style={{ borderColor: colors.borderSoft }}>
                  <span style={{ color: colors.soft }}>{m.label}</span>
                  <span className="tabular-nums" style={{ color: fmt.color }}>
                    {fmt.text}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
            Expected move (1D)
          </div>
          <ul className="mt-2 space-y-2">
            {data.expectedMoves.map((e) => (
              <li key={e.label}>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: colors.soft }}>{e.label}</span>
                  <span className="tabular-nums" style={{ color: colors.text }}>
                    {e.movePct.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: colors.borderSoft }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round(e.bar * 100)}%`, background: colors.orange }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div style={surface}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Trading implications
          </div>
          <div className="mt-3 space-y-3">
            {data.tradeIdeas.map((t) => (
              <div key={t.title} className="rounded border p-3" style={{ borderColor: colors.borderSoft, background: colors.panelSoft }}>
                <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: colors.orange }}>
                  {t.title}
                </div>
                <p className="mt-2 text-[12px] leading-snug" style={{ color: colors.soft }}>
                  {t.rationale}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                  <div>
                    <div style={{ color: colors.muted }}>Entry</div>
                    <div style={{ color: colors.text }}>{t.entry}</div>
                  </div>
                  <div>
                    <div style={{ color: colors.muted }}>TP</div>
                    <div style={{ color: colors.text }}>{t.tp}</div>
                  </div>
                  <div>
                    <div style={{ color: colors.muted }}>SL</div>
                    <div style={{ color: colors.text }}>{t.sl}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
            Why now?
          </div>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: colors.soft }}>
            {data.regimeNarrative}
          </p>
        </div>
      </div>

      <div style={surface}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
              Cross event analysis
            </div>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: colors.soft }}>
              {data.crossEventAnalysis}
            </p>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
              {data.historicalPatternTitle}
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[12px] tabular-nums">
                <thead>
                  <tr style={{ color: colors.muted }}>
                    <th className="pb-2 text-left text-[10px] uppercase tracking-[0.08em]">{" "}</th>
                    <th className="pb-2 text-right">Equity 1D</th>
                    <th className="pb-2 text-right">10Y 1D</th>
                    <th className="pb-2 text-right">USD 1D</th>
                  </tr>
                </thead>
                <tbody>
                  {data.historicalPatternRows.map((row) => (
                    <tr key={row.occurrence} className="border-t" style={{ borderColor: colors.borderSoft }}>
                      <td className="py-2" style={{ color: colors.soft }}>
                        {row.occurrence}
                      </td>
                      <td className="py-2 text-right" style={{ color: row.equity1d >= 0 ? colors.green : colors.red }}>
                        {row.equity1d >= 0 ? "+" : ""}
                        {row.equity1d.toFixed(2)}%
                      </td>
                      <td className="py-2 text-right" style={{ color: colors.text }}>
                        {row.yield10y1d >= 0 ? "+" : ""}
                        {row.yield10y1d.toFixed(1)} bps
                      </td>
                      <td className="py-2 text-right" style={{ color: row.usd1d >= 0 ? colors.green : colors.red }}>
                        {row.usd1d >= 0 ? "+" : ""}
                        {row.usd1d.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[12px]" style={{ color: colors.soft }}>
              Win rate:{" "}
              <span className="font-semibold tabular-nums" style={{ color: colors.green }}>
                {data.historicalWinRatePct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={surface}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Market snapshot
          </span>
          <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: colors.muted }}>
            Snapshot time: {data.marketSnapshotTimeEt}
          </span>
        </div>
        <div className="mt-3">
          <MarketSnapshotGrid items={data.marketSnapshot} colors={colors} />
        </div>
      </div>
    </>
  );
}

function EveningPanels({
  data,
  surface,
  colors,
  importancePalette,
}: {
  data: EveningBriefData;
  surface: ReturnType<typeof nextPanelSurfaceStyle>;
  colors: ReturnType<typeof useNextShellTheme>["colors"];
  importancePalette: { high: string; mid: string; low: string };
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div style={surface}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
              {data.briefDate}
            </span>
            <span
              className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ borderColor: colors.purple, color: colors.purple }}
            >
              Evening
            </span>
          </div>
          <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight" style={{ color: colors.text }}>
            {data.headline}
          </h1>
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Executive summary
          </div>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: colors.soft }}>
            {data.executiveSummary}
          </p>
        </div>
        <div style={surface}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Key events
          </div>
          <div className="mt-3">
            <KeyEventsTable rows={data.keyEvents} colors={colors} importancePalette={importancePalette} />
          </div>
        </div>
      </div>

      <div style={surface}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
          Prediction scorecard
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Accuracy", value: `${data.accuracyPct}%` },
            { label: "Correct", value: String(data.correct) },
            { label: "Incorrect", value: String(data.incorrect) },
            { label: "Total", value: String(data.total) },
          ].map((m) => (
            <div key={m.label} className="rounded border px-3 py-2" style={{ borderColor: colors.borderSoft, background: colors.panelSoft }}>
              <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: colors.muted }}>
                {m.label}
              </div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums" style={{ color: colors.text }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[12px] tabular-nums">
            <thead>
              <tr style={{ color: colors.muted }}>
                <th className="pb-2 text-left text-[10px] uppercase tracking-[0.08em]">Event</th>
                <th className="pb-2 text-center">Predicted</th>
                <th className="pb-2 text-center">Actual</th>
                <th className="pb-2 text-right">Surprise %</th>
              </tr>
            </thead>
            <tbody>
              {data.scorecard.map((s) => (
                <tr key={s.event} className="border-t" style={{ borderColor: colors.borderSoft, color: s.correct ? colors.green : colors.red }}>
                  <td className="py-2" style={{ color: colors.text }}>
                    {s.event}
                  </td>
                  <td className="py-2 text-center">
                    <DirectionCell dir={s.predicted} />
                  </td>
                  <td className="py-2 text-center">
                    <DirectionCell dir={s.actual} />
                  </td>
                  <td className="py-2 text-right tabular-nums">{s.surprisePct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={surface}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
          Results summary
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {data.resultsCards.map((c) => {
            const bm = beatMissStyle(c.outcome, colors);
            return (
              <div
                key={c.metric}
                className="min-w-[200px] shrink-0 rounded border p-3"
                style={{ borderColor: colors.borderSoft, background: colors.panelSoft }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px]">{c.flagEmoji}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: colors.text }}>
                    {c.metric}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase" style={{ borderColor: bm.border, color: bm.fg }}>
                    {beatMissLabel(c.outcome)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-[10px]">
                  <div>
                    <div style={{ color: colors.muted }}>Est</div>
                    <div className="tabular-nums" style={{ color: colors.soft }}>
                      {c.est}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: colors.muted }}>Prev</div>
                    <div className="tabular-nums" style={{ color: colors.soft }}>
                      {c.prev}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: colors.muted }}>Act</div>
                    <div className="tabular-nums" style={{ color: colors.text }}>
                      {c.act}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-snug" style={{ color: colors.soft }}>
                  {c.analysis}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div style={surface}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Market reaction
          </div>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: colors.soft }}>
            {data.marketReaction}
          </p>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
            Main movers
          </div>
          <ul className="mt-2 space-y-1 text-[12px]">
            {data.mainMovers.map((m) => {
              const fmt = formatOvernightChange(m.label, m.changePct, colors.green, colors.red);
              return (
                <li key={m.label} className="flex justify-between gap-2">
                  <span style={{ color: colors.soft }}>{m.label}</span>
                  <span className="tabular-nums" style={{ color: fmt.color }}>
                    {fmt.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div style={surface}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Key takeaways
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed" style={{ color: colors.soft }}>
            {data.keyTakeaways.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      </div>

      <div style={surface}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
          Tomorrow preview
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col gap-2">
            {data.sideTickers.map((t) => {
              const up = t.changePct >= 0;
              return (
                <div key={t.symbol} className="rounded border px-2 py-2" style={{ borderColor: colors.borderSoft, background: colors.panelSoft }}>
                  <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: colors.muted }}>
                    {t.symbol}
                  </div>
                  <div className="text-[13px] tabular-nums" style={{ color: colors.text }}>
                    {t.price}
                  </div>
                  <div className="text-[11px] tabular-nums" style={{ color: up ? colors.green : colors.red }}>
                    {up ? "+" : ""}
                    {t.changePct.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-[13px] leading-relaxed" style={{ color: colors.soft }}>
              {data.tomorrowPreview}
            </p>
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
              Key events
            </div>
            <ul className="mt-2 space-y-1.5 text-[12px]">
              {data.tomorrowEvents.map((e) => (
                <li key={`${e.time}-${e.name}`} className="flex gap-2">
                  <span className="tabular-nums" style={{ color: colors.orange }}>
                    {e.time}
                  </span>
                  <span style={{ color: colors.soft }}>{e.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div style={surface}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Market snapshot
          </span>
          <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: colors.muted }}>
            Snapshot time: {data.marketSnapshotTimeEt}
          </span>
        </div>
        <div className="mt-3">
          <MarketSnapshotGrid items={data.marketSnapshot} colors={colors} />
        </div>
      </div>
    </>
  );
}

export function NextBriefingsScreen() {
  const { colors: C } = useNextShellTheme();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const [edition, setEdition] = useState<BriefEdition>("morning");
  const [archiveDate, setArchiveDate] = useState<string>(BRIEFING_ARCHIVE_DAYS[0]?.date ?? "");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const briefingArchiveOptions = useMemo(
    () => BRIEFING_ARCHIVE_DAYS.map((d) => ({ value: d.date, label: d.label })),
    [],
  );

  const importancePalette = useMemo(
    () => ({
      high: C.red,
      mid: C.orange,
      low: C.green,
    }),
    [C.red, C.orange, C.green],
  );

  const morning = useMemo(() => getMorningBriefDemo(archiveDate || undefined), [archiveDate]);
  const evening = useMemo(() => getEveningBriefDemo(archiveDate || undefined), [archiveDate]);

  return (
    <section className="flex flex-col gap-2">
      <div
        className={`flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between ${archiveOpen ? "relative z-50" : ""}`}
      >
        <div className="flex gap-1 border-b sm:gap-2" style={{ borderColor: C.borderSoft }}>
          {(
            [
              ["morning", "Morning brief", C.orange],
              ["evening", "Evening wrap", C.purple],
            ] as const
          ).map(([key, label, accent]) => {
            const active = edition === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setEdition(key)}
                className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-90"
                style={{
                  color: active ? C.text : C.muted,
                  borderBottom: active ? `3px solid ${accent}` : "3px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <NextCalendarArchiveDropdown
          value={archiveDate}
          onValueChange={setArchiveDate}
          options={briefingArchiveOptions}
          aria-label="Briefing archive date"
          onOpenChange={setArchiveOpen}
        />
      </div>

      {edition === "morning" ? (
        <MorningPanels data={morning} surface={surface} colors={C} importancePalette={importancePalette} />
      ) : (
        <EveningPanels data={evening} surface={surface} colors={C} importancePalette={importancePalette} />
      )}
    </section>
  );
}
