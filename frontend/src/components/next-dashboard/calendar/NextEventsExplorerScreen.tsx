"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Expand, Minus } from "lucide-react";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { EVENTS_INDICATOR_CARDS } from "@/components/next-dashboard/calendar/eventsExplorerDemoData";
import type {
  EventsHistory,
  EventsImportance,
  EventsIndicatorCard,
  EventsRegion,
} from "@/components/next-dashboard/calendar/eventsExplorerTypes";

const REGION_FILTERS: EventsRegion[] = ["USD", "EUR", "JPY", "GBP", "CNY"];
const HISTORY_FILTERS: Array<{ id: EventsHistory; label: string }> = [
  { id: "last_month", label: "Last Month" },
  { id: "last_3m", label: "Last 3M" },
  { id: "last_year", label: "Last Year" },
  { id: "all", label: "All" },
];
const IMPORTANCE_FILTERS: EventsImportance[] = ["high", "medium", "low"];

export function NextEventsExplorerScreen() {
  const { colors: C } = useNextShellTheme();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const [region, setRegion] = useState<EventsRegion>("USD");
  const [history, setHistory] = useState<EventsHistory>("last_3m");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [importance, setImportance] = useState<Record<EventsImportance, boolean>>({
    high: true,
    medium: true,
    low: false,
  });

  const filtered = useMemo(() => {
    return EVENTS_INDICATOR_CARDS.filter((card) => {
      if (card.region !== region) return false;
      if (!importance[card.importance]) return false;
      return true;
    });
  }, [region, importance]);

  const expandedCard = useMemo(
    () => filtered.find((card) => card.id === expandedCardId) ?? null,
    [filtered, expandedCardId],
  );

  useEffect(() => {
    if (!expandedCardId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedCardId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedCardId]);

  return (
    <section className="flex flex-col gap-2">
      <div style={surface}>
        <div className="flex flex-wrap items-center gap-3">
          <FilterRow
            label="Currency / Region"
            options={REGION_FILTERS.map((x) => ({ id: x, label: x }))}
            value={region}
            onChange={(id) => setRegion(id as EventsRegion)}
            colors={C}
          />
          <FilterRow
            label="History"
            options={HISTORY_FILTERS}
            value={history}
            onChange={(id) => setHistory(id as EventsHistory)}
            colors={C}
          />
          <FilterRow
            label="Importance"
            options={IMPORTANCE_FILTERS.map((x) => ({ id: x, label: x.toUpperCase() }))}
            value=""
            onChange={(id) =>
              setImportance((prev) => ({ ...prev, [id as EventsImportance]: !prev[id as EventsImportance] }))
            }
            colors={C}
            isActive={(id) => importance[id as EventsImportance]}
            colorById={(id) => ((id as EventsImportance) === "high" ? C.red : (id as EventsImportance) === "medium" ? C.yellow : C.muted)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-2 xl:grid-cols-2">
        {filtered.map((card) => (
          <IndicatorCard
            key={card.id}
            card={card}
            history={history}
            expanded={false}
            onToggleExpanded={() => setExpandedCardId(card.id)}
            asModal={false}
          />
        ))}
      </div>

      {expandedCard ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6"
          style={{ background: "rgba(3, 7, 12, 0.72)" }}
          onClick={() => setExpandedCardId(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-[1180px] overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <IndicatorCard
              card={expandedCard}
              history={history}
              expanded
              onToggleExpanded={() => setExpandedCardId(null)}
              asModal
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
  colors,
  isActive,
  colorById,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  colors: ReturnType<typeof useNextShellTheme>["colors"];
  isActive?: (id: string) => boolean;
  colorById?: (id: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
        {label}
      </span>
      {options.map((opt) => {
        const active = isActive ? isActive(opt.id) : value === opt.id;
        const activeColor = colorById ? colorById(opt.id) : colors.yellow;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className="rounded border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ borderColor: active ? activeColor : colors.borderSoft, color: active ? activeColor : colors.muted }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function IndicatorCard({
  card,
  history,
  expanded,
  onToggleExpanded,
  asModal,
}: {
  card: EventsIndicatorCard;
  history: EventsHistory;
  expanded: boolean;
  onToggleExpanded: () => void;
  asModal: boolean;
}) {
  const { colors: C } = useNextShellTheme();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const [showPriceAction, setShowPriceAction] = useState(false);

  const points = useMemo(() => {
    if (history === "last_month") return card.points.slice(-4);
    if (history === "last_3m") return card.points;
    if (history === "last_year") return [...card.points, ...card.points].slice(0, 10);
    return [...card.points, ...card.points, ...card.points].slice(0, 14);
  }, [card.points, history]);

  return (
    <div
      style={{
        ...surface,
        padding: asModal ? "14px 14px 12px" : "12px 12px 10px",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[28px] leading-none" style={{ color: C.text }}>{card.title}</h3>
          <div className="mt-1 text-[11px] uppercase tracking-[0.08em]" style={{ color: C.muted }}>
            {card.region} · {card.releases} releases
            <span
              className="ml-2 rounded border px-1.5 py-0.5 text-[9px] font-semibold"
              style={{
                borderColor: card.importance === "high" ? C.red : card.importance === "medium" ? C.yellow : C.muted,
                color: card.importance === "high" ? C.red : card.importance === "medium" ? C.yellow : C.muted,
              }}
            >
              {card.importance.toUpperCase()}
            </span>
          </div>
          <a href={card.fredUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] uppercase underline" style={{ color: C.blue }}>
            FRED Series: {card.fredLabel}
          </a>
        </div>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded border p-1.5"
          style={{ borderColor: expanded ? C.yellow : C.borderSoft, color: expanded ? C.yellow : C.muted }}
        >
          <Expand size={14} />
        </button>
      </div>

      <MiniSeriesChart points={points} tall={expanded} />

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] text-[11px] tabular-nums">
          <thead>
            <tr style={{ color: C.muted }}>
              <th className="pb-1 text-left">Date</th>
              <th className="pb-1 text-right">Forecast</th>
              <th className="pb-1 text-right">Actual</th>
              <th className="pb-1 text-right">Surprise</th>
            </tr>
          </thead>
          <tbody>
            {card.releasesTable.map((row) => (
              <tr key={row.date} className="border-t" style={{ borderColor: C.borderSoft }}>
                <td className="py-1.5">{row.date}</td>
                <td className="py-1.5 text-right">{row.forecast}</td>
                <td className="py-1.5 text-right">{row.actual}</td>
                <td className="py-1.5 text-right" style={{ color: row.surprise >= 0 ? C.green : C.red }}>
                  {row.surprise >= 0 ? "+" : ""}
                  {row.surprise.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 rounded border p-2" style={{ borderColor: C.borderSoft, background: C.panelSoft }}>
        <button
          type="button"
          className="flex w-full items-center justify-between text-[10px] uppercase tracking-[0.12em]"
          style={{ color: C.soft }}
          onClick={() => setShowPriceAction((v) => !v)}
        >
          <span>Price Action (Average Reaction)</span>
          <span className="inline-flex items-center gap-1">
            {showPriceAction ? "Hide" : "Show"}
            {showPriceAction ? <ChevronDown size={12} /> : <Minus size={12} />}
          </span>
        </button>
        {showPriceAction ? (
          <div className="mt-2 grid grid-cols-2 gap-1.5 xl:grid-cols-3">
            {card.priceAction.map((item) => (
              <div key={item.symbol} className="rounded border p-2" style={{ borderColor: C.borderSoft, background: C.panel }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold">{item.symbol}</span>
                  <span
                    className="text-[9px] uppercase"
                    style={{ color: item.bias === "bullish" ? C.green : item.bias === "bearish" ? C.red : C.muted }}
                  >
                    {item.bias}
                  </span>
                </div>
                <div className="mt-1 text-[20px] leading-none tabular-nums" style={{ color: C.text }}>
                  {item.accuracyPct}%
                </div>
                <div className="text-[10px]" style={{ color: C.muted }}>{item.events} events</div>
                <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: C.borderSoft }}>
                  <div className="h-full" style={{ width: `${item.accuracyPct}%`, background: item.accuracyPct >= 55 ? C.green : C.red }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MiniSeriesChart({ points, tall }: { points: EventsIndicatorCard["points"]; tall: boolean }) {
  const { colors: C } = useNextShellTheme();
  const width = 560;
  const height = tall ? 230 : 170;
  const pad = 18;

  const actualVals = points.map((p) => p.actual);
  const forecastVals = points.map((p) => p.forecast);
  const spyVals = points.map((p) => p.spy);
  const min = Math.min(...actualVals, ...forecastVals);
  const max = Math.max(...actualVals, ...forecastVals);
  const spyMin = Math.min(...spyVals);
  const spyMax = Math.max(...spyVals);

  const toX = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (width - pad * 2);
  const toY = (v: number) => height - pad - ((v - min) / Math.max(0.0001, max - min)) * (height - pad * 2);
  const toSpyY = (v: number) => height - pad - ((v - spyMin) / Math.max(0.0001, spyMax - spyMin)) * (height - pad * 2);

  const path = (values: number[], mapper: (v: number) => number) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${mapper(v).toFixed(1)}`).join(" ");

  return (
    <div className="mt-2 rounded border p-2" style={{ borderColor: C.borderSoft, background: C.panelSoft }}>
      <div className="mb-1 flex items-center gap-3 text-[10px] uppercase tracking-[0.1em]">
        <span style={{ color: C.green }}>Actual</span>
        <span style={{ color: C.blue }}>Forecast</span>
        <span style={{ color: C.muted }}>SPY (Right)</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className={`${tall ? "h-[230px]" : "h-[170px]"} w-full`}>
        <path d={path(actualVals, toY)} fill="none" stroke={C.green} strokeWidth="2" />
        <path d={path(forecastVals, toY)} fill="none" stroke={C.blue} strokeWidth="2" strokeDasharray="4 3" />
        <path d={path(spyVals, toSpyY)} fill="none" stroke={C.muted} strokeWidth="1.5" opacity="0.8" />
      </svg>
      <div className="mt-1 grid grid-cols-7 text-[10px]" style={{ color: C.muted }}>
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}
