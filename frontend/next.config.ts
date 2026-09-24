import type { NextConfig } from "next/server";

/**
 * Content-Security-Policy for Tycoon frontend.
 *
 * Source of truth: frontend/CSP_DOCUMENTATION.md
 *
 * connect-src is deny-by-default: only the NEAR wallet, NEAR RPC, and the
 * first-party backend / shop-api origins are allowlisted. Everything else is
 * blocked by the browser. Keep this list in sync with CSP_DOCUMENTATION.md.
 */

const isDev = process.env.NODE_ENV !== "production";

// NEAR wallet + RPC hosts (testnet + mainnet). NEAR wallet is the only
// supported chain UI per ADR-003 until Stellar is gated ready.
const NEAR_CONNECT_SRC = [
  "https://wallet.testnet.near.org",
  "https://wallet.near.org",
  "https://rpc.testnet.near.org",
  "https://rpc.mainnet.near.org",
  "https://helper.testnet.near.org",
  "https://helper.mainnet.near.org",
];

// First-party API origins. Overridable per environment so previews and
// staging can point at their own backend / shop-api without widening the
// policy to a wildcard.
const API_ORIGINS = [
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NEXT_PUBLIC_SHOP_API_URL,
].filter((origin): origin is string => Boolean(origin));

const connectSrc = [
  "'self'",
  ...NEAR_CONNECT_SRC,
  ...API_ORIGINS,
  // Dev-only: Next.js HMR / websocket transport.
  ...(isDev ? ["ws:", "wss:"] : []),
];

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `connect-src ${connectSrc.join(" ")}`,
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ""}`,
  "upgrade-insecure-requests",
];

const contentSecurityPolicy = cspDirectives.join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
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

export default nextConfig;
