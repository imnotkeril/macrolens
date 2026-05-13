"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { CALENDAR_WEEK_RANGES, getCalendarDemoGroups } from "@/components/next-dashboard/calendar/economicCalendarDemoData";
import type {
  CalendarDayGroup,
  CalendarEventItem,
  CalendarImportance,
  CalendarRegion,
  CalendarViewMode,
  ConsensusSide,
} from "@/components/next-dashboard/calendar/economicCalendarTypes";

const REGIONS: CalendarRegion[] = ["US", "EU", "JP", "GB", "CN"];
const IMPORTANCE: CalendarImportance[] = ["high", "medium", "low"];

function chipColor(value: CalendarImportance, colors: ReturnType<typeof useNextShellTheme>["colors"]) {
  if (value === "high") return colors.red;
  if (value === "medium") return colors.yellow;
  return colors.muted;
}

function predictionLabel(side: ConsensusSide) {
  if (side === "above") return "Above Consensus";
  if (side === "below") return "Below Consensus";
  return "In-line Consensus";
}

export function NextEconomicCalendarScreen() {
  const { colors: C } = useNextShellTheme();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);

  const [mode, setMode] = useState<CalendarViewMode>("week");
  const [rangeIndex, setRangeIndex] = useState(0);
  const [openEventId, setOpenEventId] = useState<string | null>("m4-high-5");
  const [importanceFilter, setImportanceFilter] = useState<Record<CalendarImportance, boolean>>({
    high: true,
    medium: true,
    low: false,
  });
  const [regionFilter, setRegionFilter] = useState<Record<CalendarRegion, boolean>>({
    US: true,
    EU: false,
    JP: false,
    GB: false,
    CN: false,
  });

  const range = CALENDAR_WEEK_RANGES[rangeIndex];

  const groups = useMemo(() => {
    const raw = getCalendarDemoGroups(range.id, mode);
    return raw
      .map((g) => {
        const events = g.events.filter((e) => importanceFilter[e.importance] && regionFilter[e.region]);
        return { ...g, events };
      })
      .filter((g) => g.events.length > 0 || g.eventsCount === 0);
  }, [mode, range.id, importanceFilter, regionFilter]);

  const totalVisibleEvents = useMemo(
    () => groups.reduce((sum, g) => sum + g.events.length, 0),
    [groups],
  );

  return (
    <section className="flex flex-col gap-2">
      <div style={surface}>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleTwo
            left="DAY"
            right="WEEK"
            active={mode}
            onChange={(next) => setMode(next as CalendarViewMode)}
            colors={C}
          />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded border"
            style={{ borderColor: C.borderSoft, color: C.muted }}
            onClick={() => setRangeIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="rounded border px-3 py-2 text-[13px] tabular-nums" style={{ borderColor: C.borderSoft, color: C.text }}>
            {range.label}
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded border"
            style={{ borderColor: C.borderSoft, color: C.muted }}
            onClick={() => setRangeIndex((i) => Math.min(CALENDAR_WEEK_RANGES.length - 1, i + 1))}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="rounded border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ borderColor: C.borderSoft, color: C.text }}
            onClick={() => {
              setMode("week");
              setRangeIndex(0);
            }}
          >
            Today
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {IMPORTANCE.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setImportanceFilter((prev) => ({ ...prev, [item]: !prev[item] }))}
                className="rounded border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  borderColor: importanceFilter[item] ? chipColor(item, C) : C.borderSoft,
                  color: importanceFilter[item] ? chipColor(item, C) : C.muted,
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {REGIONS.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setRegionFilter((prev) => ({ ...prev, [region]: !prev[region] }))}
                className="rounded border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  borderColor: regionFilter[region] ? C.yellow : C.borderSoft,
                  color: regionFilter[region] ? C.text : C.muted,
                }}
              >
                {region}
              </button>
            ))}
          </div>
        </div>
      </div>

      {groups.map((group) => (
        <DayGroup
          key={group.id}
          group={group}
          colors={C}
          openEventId={openEventId}
          onToggleEvent={(id) => setOpenEventId((prev) => (prev === id ? null : id))}
        />
      ))}
    </section>
  );
}

function ToggleTwo({
  left,
  right,
  active,
  onChange,
  colors,
}: {
  left: string;
  right: string;
  active: string;
  onChange: (value: string) => void;
  colors: ReturnType<typeof useNextShellTheme>["colors"];
}) {
  const items = [left, right];
  return (
    <div className="flex overflow-hidden rounded border" style={{ borderColor: colors.borderSoft }}>
      {items.map((item) => {
        const key = item.toLowerCase();
        const isActive = active === key;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(key)}
            className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.13em]"
            style={{
              background: isActive ? colors.panelSoft : "transparent",
              color: isActive ? colors.yellow : colors.muted,
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function DayGroup({
  group,
  colors,
  openEventId,
  onToggleEvent,
}: {
  group: CalendarDayGroup;
  colors: ReturnType<typeof useNextShellTheme>["colors"];
  openEventId: string | null;
  onToggleEvent: (id: string) => void;
}) {
  const surface = nextPanelSurfaceStyle(colors);
  return (
    <div style={surface}>
      <div className="flex items-center justify-between">
        <div className="text-[20px] leading-none" style={{ color: colors.text }}>
          {group.label}
        </div>
        <div className="text-[11px] uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
          {group.eventsCount} events
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[940px]">
          <div
            className="grid grid-cols-[64px_92px_1fr_96px_96px_96px_24px] items-center gap-2 border-b px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: colors.muted, borderColor: colors.borderSoft }}
          >
            <span>Time</span>
            <span>Ccy</span>
            <span>Event</span>
            <span>Actual</span>
            <span>Forecast</span>
            <span>Previous</span>
            <span />
          </div>
          <div className="mt-1 space-y-1">
            {group.events.map((event) => (
              <div key={event.id} className="rounded border" style={{ borderColor: colors.borderSoft }}>
                <button
                  type="button"
                  onClick={() => onToggleEvent(event.id)}
                  className="grid h-9 w-full grid-cols-[64px_92px_1fr_96px_96px_96px_24px] items-center gap-2 px-3 text-left text-[12px]"
                  style={{ color: colors.soft }}
                >
                  <span className="tabular-nums">{event.time}</span>
                  <span className="truncate">
                    {event.region} {event.currency}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: chipColor(event.importance, colors) }} />
                    <span className="truncate" style={{ color: colors.text }}>{event.event}</span>
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ color: event.beatMiss === "beat" ? colors.green : event.beatMiss === "miss" ? colors.red : colors.soft }}
                  >
                    {event.actual}
                  </span>
                  <span className="tabular-nums">{event.forecast}</span>
                  <span className="tabular-nums">{event.previous}</span>
                  <ChevronDown size={14} className={openEventId === event.id ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
                {openEventId === event.id ? <ExpandedEvent event={event} colors={colors} /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandedEvent({
  event,
  colors,
}: {
  event: CalendarEventItem;
  colors: ReturnType<typeof useNextShellTheme>["colors"];
}) {
  const total = Math.max(1, event.details.beats + event.details.inLine + event.details.misses);
  const predColor =
    event.details.aiPrediction.side === "above"
      ? colors.green
      : event.details.aiPrediction.side === "below"
        ? colors.red
        : colors.yellow;
  return (
    <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: colors.borderSoft, background: colors.panelSoft }}>
      <div className="grid gap-2 xl:grid-cols-2">
        <div className="rounded border p-3" style={{ borderColor: colors.borderSoft, background: colors.panel }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
            Historical data
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1">
            {event.details.historical.map((p) => (
              <div key={p.label} className="rounded border px-1.5 py-1.5 text-center" style={{ borderColor: colors.borderSoft }}>
                <div className="text-[9px]" style={{ color: colors.muted }}>{p.label}</div>
                <div className="mt-1 text-[11px] tabular-nums" style={{ color: colors.text }}>{p.value.toFixed(1)}</div>
                <div className="mt-1 text-[9px] uppercase" style={{ color: p.marker === "beat" ? colors.green : p.marker === "miss" ? colors.red : colors.blue }}>
                  {p.marker}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
            <Metric label="Beats" value={event.details.beats} color={colors.green} />
            <Metric label="In-line" value={event.details.inLine} color={colors.blue} />
            <Metric label="Misses" value={event.details.misses} color={colors.red} />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: colors.borderSoft }}>
            <div className="h-full" style={{ width: `${(event.details.beats / total) * 100}%`, background: colors.green }} />
          </div>
        </div>

        <div className="rounded border p-3" style={{ borderColor: colors.borderSoft, background: colors.panel }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
            AI prediction
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="rounded border px-2 py-0.5 text-[11px] font-semibold uppercase" style={{ borderColor: predColor, color: predColor }}>
              {predictionLabel(event.details.aiPrediction.side)}
            </span>
            <span className="text-[16px] tabular-nums" style={{ color: colors.text }}>
              {event.details.aiPrediction.confidencePct}%
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: colors.soft }}>
            {event.details.aiPrediction.rationale}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px]" style={{ color: colors.soft }}>
            {event.details.aiPrediction.factors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.details.aiPrediction.relatedInstruments.map((r) => (
              <span key={r} className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: colors.borderSoft, color: colors.text }}>
                {r}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.1em]" style={{ color: colors.green }}>
            {event.details.aiPrediction.strongestRegimeImpact}
          </div>
        </div>
      </div>

      <div className="mt-2 rounded border p-3" style={{ borderColor: colors.borderSoft, background: colors.panel }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
          Price action profiles
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
          {event.details.profiles.map((profile) => (
            <div key={profile.symbol} className="rounded border p-2" style={{ borderColor: colors.borderSoft, background: colors.panelSoft }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">{profile.symbol}</span>
                <span
                  className="text-[10px] uppercase"
                  style={{
                    color:
                      profile.bias === "bullish" ? colors.green : profile.bias === "bearish" ? colors.red : colors.muted,
                  }}
                >
                  {profile.bias}
                </span>
              </div>
              <div className="mt-1 text-[12px] tabular-nums" style={{ color: profile.avgMovePct >= 0 ? colors.green : colors.red }}>
                {profile.avgMovePct >= 0 ? "+" : ""}
                {profile.avgMovePct.toFixed(2)}%
              </div>
              <div className="mt-1 text-[10px]" style={{ color: colors.muted }}>
                Samples {profile.samples}
              </div>
              <div className="mt-1 text-[10px]" style={{ color: colors.soft }}>
                {profile.pattern}
              </div>
              <div className="text-[10px]" style={{ color: colors.soft }}>
                Sensitivity {profile.sensitivity}
              </div>
            </div>
          ))}
        </div>
        <a
          href={event.details.fredSeriesUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-[10px] uppercase tracking-[0.1em] underline"
          style={{ color: colors.blue }}
        >
          {event.details.fredSeriesLabel}
        </a>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded border px-2 py-1" style={{ borderColor: color }}>
      <div className="text-[9px] uppercase tracking-[0.1em]" style={{ color }}>
        {label}
      </div>
      <div className="text-[14px] tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
