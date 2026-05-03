/**
 * Base URL for `fetch` in `api.ts` / `forecastLabApi.ts`.
 *
 * - **Browser:** when `NEXT_PUBLIC_API_URL` is unset, returns `""` so requests use same-origin `/api/...`
 *   and Next.js `rewrites()` proxy to FastAPI (`next.config.js`). Set `NEXT_PUBLIC_API_URL` to an absolute
 *   backend URL only if you intentionally bypass the proxy (e.g. cross-host debugging).
 * - **Server (RSC / Node):** prefer internal service URL when present (Docker), then public URL.
 */
export function apiFetchOrigin(): string {
  if (typeof window !== "undefined") {
    const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
    return pub || "";
  }
  return (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000"
  );
}
