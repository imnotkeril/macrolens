/**
 * Forecast Lab API client — isolated from legacy ML helpers in api.ts.
 */
import type {
  BundleInfo,
  ForecastLabSummary,
  PhaseAssetAlignment,
  RegimeHistoryListResponse,
  RegimeHistoryMaterializeResponse,
  TrainStatus,
} from "@/types/forecastLab";

/**
 * Browser: same-origin `/api` (rewritten by Next to the backend — see next.config.js).
 * Server (unlikely here): absolute URL for any SSR/tooling.
 */
function apiBase(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
}

async function flFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { ...init?.headers, Accept: "application/json" },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail ? `Forecast Lab API ${res.status}: ${detail.slice(0, 400)}` : `Forecast Lab API ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

export const getForecastLabSummary = (opts?: { asOf?: string; alignMonthEnd?: boolean }) => {
  const q = new URLSearchParams();
  if (opts?.asOf) q.set("as_of", opts.asOf);
  if (opts?.alignMonthEnd === true) q.set("align_month_end", "true");
  if (opts?.alignMonthEnd === false) q.set("align_month_end", "false");
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return flFetch<ForecastLabSummary>(`/api/forecast-lab/summary${suffix}`);
};

export const getForecastLabBundle = () => flFetch<BundleInfo>("/api/forecast-lab/bundle");

export const getForecastLabTrainStatus = () =>
  flFetch<TrainStatus>("/api/forecast-lab/train/status");

export const postForecastLabTrain = () =>
  flFetch<{ status: string; message: string }>("/api/forecast-lab/train", { method: "POST" });

export const postForecastLabTrainResetProgress = () =>
  flFetch<TrainStatus>("/api/forecast-lab/train/reset-progress", { method: "POST" });

export const getForecastLabDiagnosticsOos = () =>
  flFetch<{ bundle_id: string; metrics: Record<string, unknown> }>("/api/forecast-lab/diagnostics/oos");

export const getForecastLabPhaseAlignment = (opts?: { dateFrom?: string; dateTo?: string }) => {
  const q = new URLSearchParams();
  if (opts?.dateFrom) q.set("date_from", opts.dateFrom);
  if (opts?.dateTo) q.set("date_to", opts.dateTo);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return flFetch<PhaseAssetAlignment>(`/api/forecast-lab/diagnostics/phase-asset-alignment${suffix}`);
};

export const postForecastLabLogSnapshot = (opts?: { asOf?: string; alignMonthEnd?: boolean }) => {
  const q = new URLSearchParams();
  if (opts?.asOf) q.set("as_of", opts.asOf);
  if (opts?.alignMonthEnd === true) q.set("align_month_end", "true");
  if (opts?.alignMonthEnd === false) q.set("align_month_end", "false");
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return flFetch<{ status: string; id?: number | null }>(`/api/forecast-lab/log-snapshot${suffix}`, {
    method: "POST",
  });
};

export const getForecastLabRegimeHistory = (opts?: { dateFrom?: string; dateTo?: string }) => {
  const q = new URLSearchParams();
  if (opts?.dateFrom) q.set("date_from", opts.dateFrom);
  if (opts?.dateTo) q.set("date_to", opts.dateTo);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return flFetch<RegimeHistoryListResponse>(`/api/forecast-lab/regime-history${suffix}`);
};

export const postForecastLabRegimeHistoryMaterialize = (opts?: {
  dateFrom?: string;
  dateTo?: string;
  assetConfirmThreshold?: number;
}) => {
  const q = new URLSearchParams();
  if (opts?.dateFrom) q.set("date_from", opts.dateFrom);
  if (opts?.dateTo) q.set("date_to", opts.dateTo);
  if (opts?.assetConfirmThreshold != null) q.set("asset_confirm_threshold", String(opts.assetConfirmThreshold));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return flFetch<RegimeHistoryMaterializeResponse>(
    `/api/forecast-lab/regime-history/materialize${suffix}`,
    { method: "POST" }
  );
};
