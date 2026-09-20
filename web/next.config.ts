import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No remotePatterns: every image the page renders is served from public/.
  // See scripts/build-assets.mjs.
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  turbopack: {},
};

export default nextConfig;
