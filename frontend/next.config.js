/** @type {import('next').NextConfig} */
const backend =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.BACKEND_URL ||
  "https://imnotkeril-macrolens-api.hf.space";

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
