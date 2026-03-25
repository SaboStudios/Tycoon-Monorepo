import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Emit detailed build output consumed by scripts/check-bundle-size.mjs
  experimental: {
    webpackBuildWorker: true,
  },
};

export default nextConfig;
