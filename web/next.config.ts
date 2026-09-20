import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No remotePatterns: every image the page renders is served from public/,
  // so nothing is hotlinked and no remote host needs allowing.
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  turbopack: {},
};

export default nextConfig;
