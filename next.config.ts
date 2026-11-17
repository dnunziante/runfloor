import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.RUNFLOOR_LOCAL_TOOLING_ROOT ? { turbopack: { root: process.env.RUNFLOOR_LOCAL_TOOLING_ROOT } } : {}),
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["pdf-parse"],
  async redirects() {
    const localDemo = process.env.NODE_ENV !== "production" && process.env.LOCAL_DEMO_MODE === "true";
    return localDemo
      ? [
          { source: "/", destination: "/dashboard", permanent: false },
          { source: "/login", destination: "/dashboard", permanent: false },
        ]
      : [];
  },
};

export default nextConfig;
