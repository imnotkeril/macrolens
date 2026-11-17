"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { getNews, type LiveNewsItem } from "@/lib/api";

const TOPICS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  { id: "inflation", label: "Inflation" },
  { id: "rates", label: "Rates" },
  { id: "jobs", label: "Jobs" },
  { id: "growth", label: "Growth" },
  { id: "markets", label: "Markets" },
  { id: "other", label: "Other" },
];

const DAY_OPTIONS = [1, 3, 7, 30] as const;

function timeLabel(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const hours = (Date.now() - t.getTime()) / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return t.toISOString().slice(0, 10);
}

export function NextNewsScreen() {
  const { colors: C } = useNextShellTheme();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const [topic, setTopic] = useState("all");
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(7);
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["news", topic, days],
    queryFn: () => getNews({ days, limit: 100, topic: topic === "all" ? undefined : topic }),
    staleTime: 120_000,
  });

  const toneColor = (item: LiveNewsItem) => {
    if (!item.tone) return C.muted;
    if (item.tone.label === "positive") return C.green;
    if (item.tone.label === "negative") return C.red;
    return C.soft;
  };

  return (
    <section className="flex flex-col gap-2">
      <div style={surface}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="ml-1 flex flex-wrap items-center gap-1.5">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopic(t.id)}
                className="rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  borderColor: topic === t.id ? C.orange : C.borderSoft,
                  color: topic === t.id ? C.yellow : C.muted,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className="rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  borderColor: days === d ? C.orange : C.borderSoft,
                  color: days === d ? C.yellow : C.muted,
                }}
              >
                {d === 1 ? "24h" : `${d}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={surface}>
        {isLoading ? (
          <p className="p-3 text-[12px]" style={{ color: C.muted }}>
            Loading news…
          </p>
        ) : isError ? (
          <p className="p-3 text-[12px]" style={{ color: C.red }}>
            News could not be loaded. Try again after the next data refresh.
          </p>
        ) : !data?.length ? (
          <p className="p-3 text-[12px]" style={{ color: C.muted }}>
            No news for this filter in the selected period.
          </p>
        ) : (
          <div className="space-y-1">
            {data.map((item) => {
              const expanded = openId === item.id;
              return (
                <div key={item.id} className="rounded border" style={{ borderColor: C.borderSoft }}>
                  <button
                    type="button"
                    onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                    className="grid w-full grid-cols-[64px_minmax(0,170px)_minmax(0,1fr)_auto_16px] items-center gap-2 px-3 py-2 text-left"
                    style={{ color: C.soft }}
                  >
                    <span className="text-[12px] tabular-nums">{timeLabel(item.published_at)}</span>
                    <span className="min-w-0 truncate text-[11px] uppercase tracking-[0.08em]" style={{ color: C.muted }}>
                      {item.source} · {item.topic ?? "other"}
                    </span>
                    <span className="min-w-0 truncate text-[13px]" style={{ color: C.text }}>
                      {item.title}
                    </span>
                    <span
                      className="min-w-0 truncate rounded border px-2 py-0.5 text-[11px] uppercase"
                      style={{ borderColor: toneColor(item), color: toneColor(item) }}
                      title="FinBERT tone: positive / neutral / negative"
                    >
                      {item.tone ? `${item.tone.label} ${item.tone.score > 0 ? "+" : ""}${item.tone.score.toFixed(2)}` : "unscored"}
                    </span>
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expanded ? (
                    <div className="border-t p-3" style={{ borderColor: C.borderSoft, background: C.panelSoft }}>
                      <p className="text-[12px] leading-relaxed" style={{ color: C.soft }}>
                        {item.summary || "No summary provided by the source."}
                      </p>
                      <div className="mt-2 border-t pt-2" style={{ borderColor: C.borderSoft }}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-[11px] uppercase tracking-[0.1em]"
                          style={{ borderColor: C.borderSoft, color: C.text, background: C.panel }}
                        >
                          Read Full Article
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
