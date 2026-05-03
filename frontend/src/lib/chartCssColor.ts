/**
 * lightweight-charts paints on canvas — `var(--token)` and invalid concatenations like `var(--x)18`
 * must be resolved to concrete `rgb()` / `rgba()` first.
 */

export function resolveCssColorForCanvas(color: string): string {
  if (typeof document === "undefined") return "#888888";
  const c = color.trim();
  if (c === "transparent") return "rgba(0, 0, 0, 0)";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c;
  if (/^rgba?\(/i.test(c)) return c;
  const el = document.createElement("div");
  el.style.color = c;
  el.style.position = "absolute";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  document.body.removeChild(el);
  return resolved || "rgb(136, 136, 136)";
}

export function rgbaFromCssColor(color: string, alpha: number): string {
  const rgb = resolveCssColorForCanvas(color);
  const m = rgb.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!m) return `rgba(136, 136, 136, ${alpha})`;
  return `rgba(${Math.round(Number(m[1]))},${Math.round(Number(m[2]))},${Math.round(Number(m[3]))},${alpha})`;
}
