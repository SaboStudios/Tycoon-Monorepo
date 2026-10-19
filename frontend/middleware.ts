import { NextRequest, NextResponse } from 'next/server';

/**
 * CSP connect-src allowlist for NEAR wallet + API hosts.
 *
 * Source of truth: frontend/CSP_DOCUMENTATION.md
 *
 * Deny-by-default: only the hosts below may be reached via fetch/XHR/WebSocket
 * from the browser. Everything else is blocked by the CSP.
 */

// NEAR wallet (testnet + mainnet) and NEAR RPC endpoints.
const NEAR_WALLET_HOSTS = [
  'https://wallet.testnet.near.org',
  'https://wallet.near.org',
  'https://testnet.mynearwallet.com',
  'https://app.mynearwallet.com',
];

const NEAR_RPC_HOSTS = [
  'https://rpc.testnet.near.org',
  'https://rpc.mainnet.near.org',
  'https://archival-rpc.testnet.near.org',
  'https://archival-rpc.mainnet.near.org',
];

// Backend (NestJS) and shop-api (NestJS purchases SoT) origins.
// Configurable per environment; defaults cover local development.
function apiHosts(): string[] {
  const hosts = new Set<string>();

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backend) hosts.add(backend.replace(/\/$/, ''));

  const shopApi = process.env.NEXT_PUBLIC_SHOP_API_URL;
  if (shopApi) hosts.add(shopApi.replace(/\/$/, ''));

  // Local development defaults.
  if (process.env.NODE_ENV !== 'production') {
    hosts.add('http://localhost:3001');
    hosts.add('http://localhost:3002');
    hosts.add('ws://localhost:3001');
    hosts.add('ws://localhost:3002');
  }

  return Array.from(hosts);
}

function buildConnectSrc(): string {
  const sources = [
    "'self'",
    ...NEAR_WALLET_HOSTS,
    ...NEAR_RPC_HOSTS,
    ...apiHosts(),
  ];
  return Array.from(new Set(sources)).join(' ');
}

function buildCsp(): string {
  return [
    "default-src 'self'",
    `connect-src ${buildConnectSrc()}`,
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "frame-src 'self' https://wallet.testnet.near.org https://wallet.near.org",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', buildCsp());
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
