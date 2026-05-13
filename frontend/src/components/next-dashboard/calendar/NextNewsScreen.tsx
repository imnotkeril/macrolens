"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { NEWS_CATEGORIES, NEWS_ITEMS } from "@/components/next-dashboard/calendar/newsFeedDemoData";
import type { NewsCategory, NewsImpact } from "@/components/next-dashboard/calendar/newsFeedTypes";

const IMPACTS: NewsImpact[] = ["high", "medium", "low"];

function impactColor(impact: NewsImpact, colors: ReturnType<typeof useNextShellTheme>["colors"]) {
  if (impact === "high") return colors.red;
  if (impact === "medium") return colors.yellow;
  return colors.muted;
}

export function NextNewsScreen() {
  const { colors: C } = useNextShellTheme();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const [impactFilter, setImpactFilter] = useState<Record<NewsImpact, boolean>>({
    high: true,
    medium: true,
    low: false,
  });
  const [category, setCategory] = useState<"all" | NewsCategory>("all");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(NEWS_ITEMS[0]?.id ?? null);

  const categoryLabel = useMemo(
    () => NEWS_CATEGORIES.find((c) => c.id === category)?.label ?? "All Categories",
    [category],
  );

  useEffect(() => {
    if (!categoryOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (categoryRef.current?.contains(e.target as Node)) return;
      setCategoryOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [categoryOpen]);

  const filtered = useMemo(() => {
    return NEWS_ITEMS.filter((item) => {
      if (!impactFilter[item.impact]) return false;
      if (category !== "all" && item.category !== category) return false;
      return true;
    });
  }, [impactFilter, category]);

  const filterBarStyle = useMemo(() => {
    return {
      ...surface,
      overflow: "visible" as const,
      ...(categoryOpen ? { position: "relative" as const, zIndex: 50 } : {}),
    };
  }, [surface, categoryOpen]);

  return (
    <section className="flex flex-col gap-2">
      <div style={filterBarStyle}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: C.borderSoft, color: C.green }}>
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.green }} />
            Live
          </div>
          <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: C.muted }}>
            just now
          </span>
          <div className="ml-1 flex flex-wrap items-center gap-1.5">
            {IMPACTS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setImpactFilter((prev) => ({ ...prev, [item]: !prev[item] }))}
                className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  borderColor: impactFilter[item] ? impactColor(item, C) : C.borderSoft,
                  color: impactFilter[item] ? impactColor(item, C) : C.muted,
                }}
              >
                {item}
              </button>
            ))}
          </div>

          <div ref={categoryRef} className="relative ml-1 min-w-[200px]">
            <button
              type="button"
              onClick={() => setCategoryOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-90"
              style={{
                borderColor: categoryOpen ? C.orange : C.borderSoft,
                color: C.text,
                background: C.panel,
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
              }}
              aria-expanded={categoryOpen}
              aria-haspopup="listbox"
            >
              <span className="truncate">{categoryLabel}</span>
              <ChevronDown size={14} className={categoryOpen ? "rotate-180 transition-transform" : "transition-transform"} style={{ color: C.muted }} />
            </button>
            {categoryOpen ? (
              <div
                className="absolute left-0 right-0 z-50 mt-1 max-h-[280px] overflow-auto rounded border py-1"
                style={{
                  borderColor: C.borderSoft,
                  background: C.panel,
                  boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
                }}
                role="listbox"
              >
                {NEWS_CATEGORIES.map((entry) => {
                  const active = category === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setCategory(entry.id);
                        setCategoryOpen(false);
                      }}
                      className="flex w-full items-center px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors"
                      style={{
                        color: active ? C.yellow : C.soft,
                        background: active ? C.panelSoft : "transparent",
                        borderLeft: active ? `3px solid ${C.orange}` : "3px solid transparent",
                      }}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={surface}>
        <div className="space-y-1">
          {filtered.map((item) => {
            const expanded = openId === item.id;
            const color = impactColor(item.impact, C);
            return (
              <div key={item.id} className="rounded border" style={{ borderColor: C.borderSoft }}>
                <button
                  type="button"
                  onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                  className="grid w-full grid-cols-[16px_56px_170px_1fr_82px_20px] items-center gap-2 px-3 py-2 text-left"
                  style={{ color: C.soft }}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.unread ? C.red : C.muted }} />
                  <span className="text-[12px] tabular-nums">{item.timeLabel}</span>
                  <span className="truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: C.muted }}>
                    {item.source} · {item.category}
                  </span>
                  <span className="truncate text-[13px]" style={{ color: C.text }}>
                    {item.headline}
                  </span>
                  <span className="justify-self-end rounded border px-2 py-0.5 text-[10px] uppercase" style={{ borderColor: color, color }}>
                    {item.impact}
                  </span>
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {expanded ? (
                  <div className="border-t p-3" style={{ borderColor: C.borderSoft, background: C.panelSoft }}>
                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
                      <div className="space-y-2 xl:col-span-7">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
                            Summary (AI generated)
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: C.soft }}>
                            {item.summary}
                          </p>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
                            Key Points
                          </div>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] leading-relaxed" style={{ color: C.soft }}>
                            {item.keyPoints.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="space-y-2 xl:col-span-5">
                        <div className="rounded border p-2" style={{ borderColor: C.borderSoft, background: C.panel }}>
                          <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                            MacroLens Regime Impact
                          </div>
                          <div className="mt-1 text-[12px] leading-relaxed" style={{ color: C.soft }}>
                            {item.regimeImpact}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                            Related FRED Series
                          </div>
                          <div className="mt-1 divide-y rounded border" style={{ borderColor: C.borderSoft }}>
                            {item.fredSeries.map((series) => (
                              <div key={series.code} className="flex items-center gap-2 px-2 py-1.5 text-[11px]" style={{ borderColor: C.borderSoft }}>
                                <span className="rounded border px-1.5 py-0.5" style={{ borderColor: C.borderSoft, color: C.text }}>
                                  {series.code}
                                </span>
                                <span style={{ color: C.soft }}>{series.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2" style={{ borderColor: C.borderSoft }}>
                      <a
                        href={item.articleUrl}
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
      </div>
    </section>
  );
}

