"use client";

import { useMemo, useState } from "react";
import { NextCalendarArchiveDropdown } from "@/components/next-dashboard/calendar/NextCalendarArchiveDropdown";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";

type MinutesTab = "ai_analysis" | "full_minutes";

type QuoteTone = "neutral" | "balanced" | "hawkish";

type MeetingSnapshot = {
  id: string;
  label: string;
  meetingTitle: string;
  meetingDateIso: string;
  rateBand: string;
  vote: string;
  /** Short dissent detail for the hero KPI row (not duplicating the vote count). */
  dissentSummary: string;
  subtitle: string;
  aiReady: boolean;
  headline: string;
  policyDecision: string;
  interestRate: string;
  summary: string;
  implications: string;
  keyPoints: Array<{ label: string; tone: "blue" | "green" | "yellow" | "purple" | "gray"; text: string }>;
  outlook: Array<{ title: string; body: string; value: string }>;
  quotes: Array<{ text: string; source: string; tone: QuoteTone }>;
  fullMinutes: string;
};

const ARCHIVE: MeetingSnapshot[] = [
  {
    id: "2026-03-18",
    label: "March 2026",
    meetingTitle: "March 2026",
    meetingDateIso: "2026-03-18",
    rateBand: "3.5 - 3.75%",
    vote: "11 - 1",
    dissentSummary: "1 · 25 bp cut",
    subtitle: "Committee left policy unchanged; markets focused on timing of eventual easing.",
    aiReady: true,
    headline: "FOMC holds fed funds target unchanged; one member favors a 25 bp cut",
    policyDecision: "No Change",
    interestRate: "3.5 - 3.75%",
    summary:
      "At its March 17-18 meeting the FOMC left the target range for the federal funds rate unchanged at 3-1/2 to 3-3/4 percent (3.5-3.75%) by an 11-1 vote. Participants judged economic activity to be expanding at a solid pace, with job gains low and the unemployment rate little changed, while inflation remained somewhat elevated. The Committee emphasized meeting-by-meeting assessment of incoming data and indicated that, although many participants view eventual rate cuts as likely if inflation moves toward 2%, the timing has been pushed out given recent inflation pressures and geopolitical uncertainty.",
    implications:
      "Policy unchanged but cautious tone and heightened uncertainty imply persistent volatility. Short-term yields are likely to remain supported given elevated near-term inflation risks and market repricing that pushed the near-term funds path higher; the Fed left IORB at 3.65% and primary credit at 3.75%, which maintains a firm floor under short-term rates. Equities may remain pressured in cyclical and tech-exposed sectors sensitive to AI disruption; the dollar may retain safe-haven strength in periods of risk-off and higher energy prices should support commodity markets, particularly oil.",
    keyPoints: [
      { label: "Policy Decision", tone: "blue", text: "The Committee decided to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent (3.5-3.75%). One member preferred a 25 bp cut." },
      { label: "Economic Outlook", tone: "green", text: "Real GDP is expanding at a solid pace; staff projects growth roughly in line with potential through 2028 with unemployment near current levels then edging down." },
      { label: "Inflation", tone: "yellow", text: "Inflation remains somewhat elevated: total PCE about 2.8% and core PCE around 3.0-3.1%. Near-term pressures rose with tariffs and oil, but inflation is projected to move back toward 2% by end of next year." },
      { label: "Employment", tone: "purple", text: "Labor market is broadly in balance but softening signs exist: job gains low, unemployment 4.4% (Feb), and participants see downside risks to employment." },
      { label: "Forward Guidance", tone: "gray", text: "Committee will assess incoming data meeting-by-meeting; majority still see cuts as potentially appropriate in time, but timing has been pushed out." },
    ],
    outlook: [
      { title: "GDP", body: "Solid expansion; staff projects growth about in line with potential through 2028 with private domestic final purchases showing resilience.", value: "2.1% - 2.3%" },
      { title: "Risks", body: "Key risks include prolonged Middle East conflict, tariff-driven goods inflation, AI labor uncertainty, and downside risks to growth/employment.", value: "Balanced" },
      { title: "Inflation", body: "Core PCE remains around 3%. Near-term upside from tariffs and oil-price spike, but baseline expects renewed disinflation toward 2%.", value: "2.4% - 2.6%" },
      { title: "Employment", body: "Unemployment around 4.4% with low payroll gains; labor market broadly balanced but vulnerable to adverse shocks.", value: "4.4%" },
    ],
    quotes: [
      { text: "The Committee decided to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent.", source: "FOMC Statement", tone: "neutral" },
      { text: "Inflation remains somewhat elevated.", source: "FOMC Statement", tone: "balanced" },
      { text: "The Committee is strongly committed to supporting maximum employment and returning inflation to its 2 percent objective.", source: "FOMC Statement", tone: "hawkish" },
    ],
    fullMinutes: `Federal Reserve Board Minutes — March 2026 Meeting

Staff Economic Outlook
The staff projection of economic activity was not as strong as the one prepared for the January meeting, primarily reflecting incoming data and less expected support from financial conditions. The staff had built in only a small effect on activity from lower equity prices and higher crude oil prices associated with developments in the Middle East. Real GDP growth was expected to run about in line with potential growth through 2028.

The staff's inflation forecast for this year was slightly higher than in January, reflecting incoming data and an expected boost to consumer energy prices given the recent run-up in crude oil prices. With effects of higher oil prices and tariffs expected to wane later this year, inflation was projected to return to its previous disinflationary trend and to be close to 2 percent by the end of next year.

Risks to employment and real GDP growth were seen as tilted to the downside. Risks to inflation were viewed as somewhat skewed to the upside. A salient risk was that inflation could prove more persistent than anticipated.

Participants' Views on Current Conditions and the Economic Outlook
Participants generally observed that overall inflation remained above the Committee's 2 percent longer-run goal. Some noted that further progress in reducing inflation had been absent in recent months. Several participants remarked that near-term inflation expectations had risen in recent weeks, reflecting the substantial oil-price rise caused by events in the Middle East.

Participants anticipated that under appropriate policy, inflation would gradually move down toward 2 percent after effects of tariffs and higher oil prices faded. The vast majority noted progress toward 2 percent could be slower than previously expected and judged the risk of inflation running persistently above objective had increased.

On labor markets, participants observed unemployment had been little changed while job gains remained low. Most judged labor conditions broadly in balance, with low job growth roughly in line with slower labor-force growth. Several participants highlighted potential softening signs, including concentration of job growth in fewer sectors and softer survey indicators.

Participants observed economic activity appeared to be expanding at a solid pace. Consumer spending remained resilient and business investment robust, particularly in technology.

In policy deliberations, almost all participants supported maintaining the current target range. One participant preferred a 25 bp cut, citing restrictive policy and downside labor-market risks.

Committee Policy Actions
Members agreed available indicators suggested activity was expanding at a solid pace, job gains remained low, unemployment was little changed, and inflation remained somewhat elevated.

In support of the Committee's goals, almost all members agreed to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent. One member voted against and preferred to lower the range by 1/4 percentage point.

The Committee stated that in considering the extent and timing of additional adjustments, it would carefully assess incoming data, the evolving outlook, and the balance of risks.

Official Statement Excerpts
"Available indicators suggest that economic activity has been expanding at a solid pace. Job gains have remained low, and the unemployment rate has been little changed in recent months. Inflation remains somewhat elevated."

"The Committee seeks to achieve maximum employment and inflation at the rate of 2 percent over the longer run... The Committee is attentive to the risks to both sides of its dual mandate."

"In support of its goals, the Committee decided to maintain the target range for the federal funds rate at 3-1/2 to 3-3/4 percent... The Committee is strongly committed to supporting maximum employment and returning inflation to its 2 percent objective."

Voting
Voting for this action: Jerome H. Powell, John C. Williams, Michael S. Barr, Michelle W. Bowman, Lisa D. Cook, Beth M. Hammack, Philip N. Jefferson, Neel Kashkari, Lorie K. Logan, Anna Paulson, Christopher J. Waller.

Voting against this action: Stephen I. Miran, who preferred a 25 bp cut.

Implementation
The Board voted to maintain interest paid on reserve balances at 3.65 percent and primary credit at 3.75 percent, effective March 19, 2026.`,
  },
  {
    id: "2026-01-29",
    label: "January 2026",
    meetingTitle: "January 2026",
    meetingDateIso: "2026-01-29",
    rateBand: "3.75 - 4.00%",
    vote: "10 - 2",
    dissentSummary: "2 · easing",
    subtitle: "Maintained restrictive stance amid sticky services inflation",
    aiReady: false,
    headline: "AI analysis pending",
    policyDecision: "No Change",
    interestRate: "3.75 - 4.00%",
    summary: "AI analysis is not available for this archive snapshot.",
    implications: "Run analysis to generate policy interpretation and cross-asset implications.",
    keyPoints: [],
    outlook: [],
    quotes: [],
    fullMinutes: "Full minutes text is available in archive source and will appear here.",
  },
];

function toneColor(tone: QuoteTone, colors: ReturnType<typeof useNextShellTheme>["colors"]) {
  if (tone === "hawkish") return colors.red;
  if (tone === "balanced") return colors.yellow;
  return colors.blue;
}

function keyPointColor(
  tone: "blue" | "green" | "yellow" | "purple" | "gray",
  colors: ReturnType<typeof useNextShellTheme>["colors"],
) {
  if (tone === "blue") return colors.blue;
  if (tone === "green") return colors.green;
  if (tone === "yellow") return colors.yellow;
  if (tone === "purple") return colors.purple;
  return colors.muted;
}

type MeetingMinutesHeroProps = {
  title: string;
  meeting: MeetingSnapshot;
  C: ReturnType<typeof useNextShellTheme>["colors"];
};

function MeetingMinutesHero({ title, meeting, C }: MeetingMinutesHeroProps) {
  const tiles = [
    { label: "Policy", value: meeting.policyDecision, tabular: false as const },
    { label: "Range", value: meeting.interestRate, tabular: true as const },
    { label: "Vote", value: meeting.vote, tabular: true as const },
    { label: "Dissent", value: meeting.dissentSummary, tabular: false as const },
  ];

  return (
    <>
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
        {title}
      </div>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0 flex-1 space-y-2 text-left">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[17px] font-semibold leading-tight tracking-tight md:text-[18px]" style={{ color: C.text }}>
              {meeting.meetingTitle}
            </span>
            <span className="text-[14px] tabular-nums md:text-[15px]" style={{ color: C.muted }}>
              {meeting.meetingDateIso}
            </span>
          </div>
          <p className="text-[13px] font-medium leading-relaxed md:text-[14px]" style={{ color: meeting.aiReady ? C.green : C.muted }}>
            {meeting.headline}
          </p>
          <p className="text-[13px] leading-relaxed md:text-[14px]" style={{ color: C.soft }}>
            {meeting.subtitle}
          </p>
        </div>
        <div className="w-full min-w-0 shrink-0 overflow-x-auto lg:max-w-[440px]" aria-label="Meeting indicators">
          <div
            className="grid min-w-[300px] max-w-full grid-cols-4 gap-px overflow-hidden rounded border sm:min-w-[380px] md:min-w-[420px]"
            style={{ borderColor: C.borderSoft, background: C.borderSoft }}
          >
            {tiles.map((tile) => (
              <div key={tile.label} className="min-w-0 px-2 py-2 text-center" style={{ background: C.panelSoft }}>
                <div className="text-[9px] font-semibold uppercase leading-none tracking-[0.08em] md:text-[10px]" style={{ color: C.muted }}>
                  {tile.label}
                </div>
                <div
                  className={`mt-1 whitespace-nowrap text-[11px] font-semibold leading-tight md:text-[12px] ${tile.tabular ? "tabular-nums" : ""}`}
                  style={{ color: C.text }}
                >
                  {tile.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function NextFomcMinutesScreen() {
  const { colors: C } = useNextShellTheme();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const [tab, setTab] = useState<MinutesTab>("ai_analysis");
  const [meetingId, setMeetingId] = useState<string>(ARCHIVE[0]?.id ?? "");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const meeting = useMemo(
    () => ARCHIVE.find((item) => item.id === meetingId) ?? ARCHIVE[0],
    [meetingId],
  );

  const toolbarSurfaceStyle = useMemo(
    () => ({
      ...surface,
      overflow: "visible" as const,
      ...(archiveOpen ? { position: "relative" as const, zIndex: 50 } : {}),
    }),
    [surface, archiveOpen],
  );

  const archiveOptions = useMemo(
    () => ARCHIVE.map((item) => ({ value: item.id, label: `${item.label} · ${item.id}` })),
    [],
  );

  return (
    <section className="flex flex-col gap-2">
      <div style={toolbarSurfaceStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex overflow-hidden rounded border" style={{ borderColor: C.borderSoft }}>
            {[
              { id: "ai_analysis", label: "AI Analysis" },
              { id: "full_minutes", label: "Full Minutes" },
            ].map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as MinutesTab)}
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{
                    color: active ? C.text : C.muted,
                    background: active ? C.panelSoft : "transparent",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <NextCalendarArchiveDropdown
            value={meeting.id}
            onValueChange={setMeetingId}
            options={archiveOptions}
            aria-label="FOMC meeting archive"
            onOpenChange={setArchiveOpen}
          />
        </div>
      </div>

      {tab === "ai_analysis" ? (
        <div className="flex flex-col gap-2">
          <div style={surface}>
            <MeetingMinutesHero title="AI Market Analysis" meeting={meeting} C={C} />
          </div>

          <div style={surface}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
              Summary
            </div>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: C.soft }}>
              {meeting.summary}
            </p>
          </div>

          <div style={surface}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
              Market Implications
            </div>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: C.soft }}>
              {meeting.implications}
            </p>
          </div>

          <div style={surface}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
              Key Points
            </div>
            <div className="mt-3 space-y-4">
              {meeting.keyPoints.map((point) => {
                const labelColor = keyPointColor(point.tone, C);
                return (
                  <div key={point.label}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: labelColor }}>
                      {point.label}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: C.soft }}>
                      {point.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={surface}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
              Key Quotes
            </div>
            <div className="mt-3 space-y-3">
              {meeting.quotes.map((q, idx) => (
                <blockquote
                  key={`${q.source}-${idx}`}
                  className="border-l-2 pl-3 text-[13px] leading-relaxed"
                  style={{ borderColor: toneColor(q.tone, C), color: C.soft }}
                >
                  “{q.text}”
                  <div className="mt-1 text-[10px] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                    {q.source}
                  </div>
                </blockquote>
              ))}
            </div>
          </div>

          <div style={surface}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
              Economic Outlook
            </div>
            <div className="mt-3 overflow-x-auto pb-1 md:overflow-visible">
              <div className="grid min-w-[640px] grid-cols-4 gap-2 md:min-w-0">
                {meeting.outlook.map((item) => (
                  <div
                    key={item.title}
                    className="flex flex-col rounded border p-2"
                    style={{ borderColor: C.borderSoft, background: C.panelSoft }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.text }}>
                        {item.title}
                      </div>
                      <div
                        className="max-w-[55%] shrink-0 text-right text-[11px] font-semibold leading-snug tabular-nums"
                        style={{ color: C.yellow }}
                      >
                        {item.value}
                      </div>
                    </div>
                    <p className="mt-2 flex-1 text-[11px] leading-relaxed" style={{ color: C.soft }}>
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div style={surface}>
            <MeetingMinutesHero title="Full Minutes" meeting={meeting} C={C} />
          </div>
          <div style={surface}>
            <pre
              className="max-h-[72vh] overflow-auto whitespace-pre-wrap text-[12px] leading-relaxed"
              style={{ color: C.soft }}
            >
              {meeting.fullMinutes}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
