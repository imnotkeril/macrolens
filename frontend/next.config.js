/** @type {import('next').NextConfig} */
// Rewrites are resolved at BUILD time (baked into routes-manifest), so set BACKEND_URL /
// BACKEND_INTERNAL_URL when running `next build` (Vercel env, or the Docker build arg).
// The default is local only: a build without them must never silently proxy to production.
const backend =
  process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/next/calendar-alerts",
        destination: "/calendar/briefings",
        permanent: false,
      },
      {
        source: "/next/analysis/macro-ratios",
        destination: "/analysis/macro-overview",
        permanent: false,
      },
      {
        source: "/next/analysis/macro-overview/macro-ratios",
        destination: "/analysis/macro-overview",
        permanent: false,
      },
      {
        source: "/next",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/next/:path*",
        destination: "/:path*",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    // Proxy API to FastAPI so the browser uses same-origin `/api/*` (avoids CORS and localhost:8000 mismatches).
    return [
      {
        source: "/api/:path*",
        destination: `${backend.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
