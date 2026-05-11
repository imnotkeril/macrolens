"use client";

import { useEffect, useRef } from "react";

const STYLE_ID = "nd-dynamic-print-pages";

/** Canvas width — must match print CSS (1920px ≈ 20in @ 96dpi) */
const PAGE_WIDTH_IN = 20;

/**
 * On-screen preview uses a tall window; Chrome's print layout uses a short initial viewport.
 * `minmax(0,1fr)` rows then shrink and the first height measurement is tiny — variable @page locks that in.
 * Floor page height for dense analysis sections so the second layout pass matches the full dashboard.
 * ~15in ≈ three chart rows × min tile height + header (1920×1440 canvas feel).
 */
const ANALYSIS_DENSE_MIN_PAGE_PX = 1440;

function pxToIn(px: number) {
  return px / 96;
}

function sectionNeedsMinimumTallPage(sectionEl: HTMLElement): boolean {
  const id = sectionEl.dataset.sectionId ?? "";
  if (
    id === "analysis-market-breadth" ||
    id === "analysis-macro-overview-1" ||
    id === "analysis-macro-overview-2"
  ) {
    return true;
  }
  return Boolean(sectionEl.querySelector(".nd-report-dense-chart-grid"));
}

/**
 * Best-effort height of painted content inside a section (includes charts/SVG deep in the tree).
 * Uses geometry after layout — call only while print styles apply (matchMedia('print')).
 */
function measureSectionContentPx(root: HTMLElement): number {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.height < 1 && root.scrollHeight < 1) return 400;

  let maxBottomFromTop = 0;
  const rootTop = rootRect.top;

  const candidates: Element[] = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width < 0.25 && r.height < 0.25) continue;
    const bottom = r.bottom - rootTop;
    if (bottom > maxBottomFromTop) maxBottomFromTop = bottom;
  }

  const scrollBased = root.scrollHeight;
  const union = Math.max(maxBottomFromTop, scrollBased);

  // Large sections (dense analysis grids): union can lag Recharts layout — pad generously
  const buffered = union + 160;
  return Math.ceil(buffered * 1.12);
}

function buildCss(): string {
  const sections = document.querySelectorAll<HTMLElement>(".nd-report-pdf-section");
  if (!sections.length) return "";

  let css = "";
  sections.forEach((el, i) => {
    let hPx = measureSectionContentPx(el);
    if (sectionNeedsMinimumTallPage(el)) {
      hPx = Math.max(hPx, ANALYSIS_DENSE_MIN_PAGE_PX);
    }
    /* Cap very tall sections — browser limits apply; 400in ~= 38k px */
    const hIn = Math.min(400, Math.max(3, pxToIn(hPx)));
    css += `@page nd-sec-${i} { size: ${PAGE_WIDTH_IN}in ${hIn}in; margin: 0; }\n`;
    /*
     * avoid-page + wrong height clips content at page edge; variable @page size already targets one sheet.
     */
    css += `.nd-report-pdf-section[data-section-index="${i}"] { page: nd-sec-${i} !important; break-after: page; break-inside: auto; page-break-inside: auto; }\n`;
  });
  css += `.nd-report-pdf-section:last-of-type { break-after: auto !important; }\n`;
  return css;
}

function inject() {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildCss();
}

function removeInjected() {
  document.getElementById(STYLE_ID)?.remove();
}

export function useVariablePdfSectionPages(enabled: boolean) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const scheduleInject = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            inject();
          });
        });
      }, 48);
    };

    const runBurst = () => {
      void document.fonts.ready.then(scheduleInject);
      scheduleInject();
      window.setTimeout(scheduleInject, 0);
      window.setTimeout(scheduleInject, 120);
      window.setTimeout(scheduleInject, 280);
      window.setTimeout(scheduleInject, 520);
      window.setTimeout(scheduleInject, 900);
      window.setTimeout(scheduleInject, 1400);
      window.setTimeout(scheduleInject, 2200);
      window.setTimeout(scheduleInject, 3500);
    };

    const startObserving = () => {
      observerRef.current?.disconnect();
      const sections = document.querySelectorAll(".nd-report-pdf-section");
      if (!sections.length) return;
      const mo = new MutationObserver(() => scheduleInject());
      observerRef.current = mo;
      sections.forEach((sec) => {
        mo.observe(sec, { subtree: true, childList: true, attributes: true, characterData: false });
      });
      window.setTimeout(() => {
        observerRef.current?.disconnect();
        observerRef.current = null;
      }, 5200);
    };

    const onBeforePrint = () => {
      runBurst();
      startObserving();
    };

    const onAfterPrint = () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      removeInjected();
    };

    const mq = window.matchMedia("print");
    const onMqChange = () => {
      if (mq.matches) {
        runBurst();
        startObserving();
      } else {
        observerRef.current?.disconnect();
        removeInjected();
      }
    };

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    mq.addEventListener("change", onMqChange);

    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      mq.removeEventListener("change", onMqChange);
      observerRef.current?.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      removeInjected();
    };
  }, [enabled]);
}
