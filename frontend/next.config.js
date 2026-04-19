/** @type {import('next').NextConfig} */
const backend =
  process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  output: "standalone",
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
