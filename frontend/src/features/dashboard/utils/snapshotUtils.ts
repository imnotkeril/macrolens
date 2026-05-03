export function normalizeTiltLabel(weight: string) {
  const w = weight.trim().toLowerCase();
  if (w === "ow" || w.includes("over")) return "OW";
  if (w === "uw" || w.includes("under")) return "UW";
  return "N";
}

export function tiltArrow(tilt: string) {
  if (tilt === "OW") return "↑";
  if (tilt === "UW") return "↓";
  return "→";
}

export function extractLeg(legs: string, side: "long" | "short") {
  const pattern = side === "long" ? /LONG\s+([A-Z0-9._-]+)/i : /SHORT\s+([A-Z0-9._-]+)/i;
  const match = legs.match(pattern);
  return match?.[1]?.toUpperCase() ?? null;
}

export function summarizeLegs(legs: string) {
  const compact = legs.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  if (!compact) return "DIRECTIONAL";
  return compact.length > 16 ? `${compact.slice(0, 16).trim()}…` : compact.toUpperCase();
}

export function compactIdeaThesis(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "No thesis";
  return compact.length > 58 ? `${compact.slice(0, 58).trim()}…` : compact;
}

export function expandTilt(weight: string) {
  const w = weight.trim().toLowerCase();
  if (w === "ow" || w.includes("over")) return "overweight";
  if (w === "uw" || w.includes("under")) return "underweight";
  return "neutral";
}

export function normalizeGeoTilt(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value.includes("over")) return "overweight";
  if (value.includes("under")) return "underweight";
  return "neutral";
}

export function geoTiltColor(tilt: string) {
  if (tilt === "overweight") return "rgba(112,171,104,0.82)";
  if (tilt === "underweight") return "rgba(212,93,114,0.78)";
  return "rgba(121,96,163,0.76)";
}

export function geoTiltWeight(tilt: string) {
  if (tilt === "overweight") return 0.6;
  if (tilt === "underweight") return 0.4;
  return 0.5;
}

export function tiltColor(weight: string) {
  const n = normalizeTiltLabel(weight);
  if (n === "OW") return "var(--nd-green)";
  if (n === "UW") return "var(--nd-red)";
  return "var(--nd-soft)";
}
