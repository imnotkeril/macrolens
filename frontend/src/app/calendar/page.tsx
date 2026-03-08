"use client";

import { useQuery } from "@tanstack/react-query";
import { getCalendar } from "@/lib/api";
import { cn, CATEGORY_LABELS } from "@/lib/utils";
import type { CalendarEvent } from "@/types";

function importanceDots(level: number) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i <= level ? "bg-accent-amber" : "bg-bg-elevated"
          )}
        />
      ))}
    </span>
  );
}

function eventTypeLabel(type: string) {
  switch (type) {
    case "fomc_decision":
      return (
        <span className="badge bg-accent-red/10 text-accent-red border-accent-red/20 text-[9px]">
          FOMC
        </span>
      );
    case "fomc_minutes":
      return (
        <span className="badge bg-accent-amber/10 text-accent-amber border-accent-amber/20 text-[9px]">
          MINUTES
        </span>
      );
    default:
      return null;
  }
}

function surpriseBadge(pct: number | null) {
  if (pct === null || pct === undefined) return null;
  const color =
    pct > 0.5
      ? "text-accent-green"
      : pct < -0.5
      ? "text-accent-red"
      : "text-text-muted";
  return (
    <span className={cn("text-xs tabular-nums font-light", color)}>
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function reactionBadge(pct: number | null) {
  if (pct === null || pct === undefined) return <span className="text-[10px] text-text-muted">—</span>;
  const color = pct > 0 ? "text-accent-green" : pct < 0 ? "text-accent-red" : "text-text-muted";
  return (
    <span className={cn("text-xs tabular-nums font-light", color)}>
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

function daysUntil(dateStr: string) {
  const diff = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff}d`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function UpcomingRow({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-bg-card px-4 py-3 hover:border-accent/20 transition-colors">
      <div className="flex items-center gap-4">
        <div className="text-center min-w-[44px]">
          <div className="text-xs font-medium text-accent tabular-nums">
            {daysUntil(event.date)}
          </div>
          <div className="text-[10px] text-text-muted">{formatDate(event.date)}</div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-text-primary">{event.name}</span>
            {eventTypeLabel(event.event_type)}
          </div>
          {event.category && (
            <div className="text-[10px] text-text-muted">
              {CATEGORY_LABELS[event.category] || event.category}
              {event.frequency ? ` · ${event.frequency}` : ""}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {event.previous !== null && (
          <div className="text-right">
            <div className="text-[10px] text-text-muted">Previous</div>
            <div className="text-xs text-text-secondary tabular-nums">
              {event.previous?.toLocaleString()}
            </div>
          </div>
        )}
        {importanceDots(event.importance)}
      </div>
    </div>
  );
}

function RecentRow({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-bg-card px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="text-center min-w-[44px]">
          <div className="text-[10px] text-text-muted">{formatDate(event.date)}</div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-text-primary">{event.name}</span>
            {eventTypeLabel(event.event_type)}
          </div>
          {event.category && (
            <div className="text-[10px] text-text-muted">
              {CATEGORY_LABELS[event.category] || event.category}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-5">
        {event.actual !== null && (
          <div className="text-right">
            <div className="text-[10px] text-text-muted">Actual</div>
            <div className="text-xs text-text-primary tabular-nums font-medium">
              {event.actual?.toLocaleString()}
            </div>
          </div>
        )}
        {event.previous !== null && (
          <div className="text-right">
            <div className="text-[10px] text-text-muted">Previous</div>
            <div className="text-xs text-text-secondary tabular-nums">
              {event.previous?.toLocaleString()}
            </div>
          </div>
        )}
        <div className="text-right min-w-[48px]">
          <div className="text-[10px] text-text-muted">Surprise</div>
          {surpriseBadge(event.surprise_pct)}
        </div>
        <div className="text-right min-w-[48px]">
          <div className="text-[10px] text-text-muted">S&P 500</div>
          {reactionBadge(event.market_reaction_1d)}
        </div>
        {importanceDots(event.importance)}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { data: cal, isLoading } = useQuery({
    queryKey: ["calendar"],
    queryFn: getCalendar,
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-sm font-light text-text-muted animate-fade-in">
          Loading calendar...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center py-4">
        <h1 className="text-3xl font-extralight tracking-tight text-text-primary mb-1">
          Economic Calendar
        </h1>
        <p className="text-sm font-light text-text-muted">
          Upcoming releases, FOMC schedule, and historical event impact
        </p>
      </div>

      {/* Next FOMC highlight */}
      {cal?.next_fomc && (
        <div className="card border-accent/20 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-lg text-accent">F</span>
              </div>
              <div>
                <div className="text-sm font-medium text-text-primary">
                  Next FOMC Decision
                </div>
                <div className="text-xs text-text-muted">
                  {new Date(cal.next_fomc.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extralight text-accent tabular-nums">
                {daysUntil(cal.next_fomc.date)}
              </div>
              <div className="text-[10px] text-text-muted">until decision</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="card-header mb-0">Upcoming Releases</span>
            <span className="text-[10px] text-text-muted">
              {cal?.upcoming.length || 0} events
            </span>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {cal?.upcoming.length === 0 && (
              <div className="text-sm text-text-muted text-center py-8">
                No upcoming events in the next 45 days
              </div>
            )}
            {cal?.upcoming.map((e, i) => (
              <UpcomingRow key={`${e.name}-${e.date}-${i}`} event={e} />
            ))}
          </div>
        </div>

        {/* Recent */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="card-header mb-0">Recent Releases</span>
            <span className="text-[10px] text-text-muted">
              {cal?.recent.length || 0} events
            </span>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {cal?.recent.length === 0 && (
              <div className="text-sm text-text-muted text-center py-8">
                No recent releases
              </div>
            )}
            {cal?.recent.map((e, i) => (
              <RecentRow key={`${e.name}-${e.date}-${i}`} event={e} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
