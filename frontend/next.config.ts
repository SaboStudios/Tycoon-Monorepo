import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: [
    "@near-wallet-selector/core",
    "@near-wallet-selector/modal-ui",
    "@near-wallet-selector/my-near-wallet",
    "@near-wallet-selector/wallet-utils",
  ],
  // Emit detailed build output consumed by scripts/check-bundle-size.mjs
  experimental: {
    webpackBuildWorker: true,
  },
  headers: async () => {
    const isDev = process.env.NODE_ENV === "development";
    const isReportOnly = process.env.CSP_REPORT_ONLY === "true";

    // CSP directives for production
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'nonce-{nonce}'",
      "style-src 'self' 'nonce-{nonce}'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.example.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];

    const cspHeader = isDev
      ? "Content-Security-Policy-Report-Only"
      : isReportOnly
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";

    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: cspHeader,
            value: cspDirectives.join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default analyzer(nextConfig);
