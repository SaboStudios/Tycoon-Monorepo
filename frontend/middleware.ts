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

// MyNearWallet origins framed by NearWalletConnect (wallet selector).
// These are the only wallet origins allowed in frame-src; no wildcards.
const NEAR_WALLET_FRAME_HOSTS = [
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

export interface CspEnv {
  NODE_ENV?: string;
  NEXT_PUBLIC_BACKEND_URL?: string;
  NEXT_PUBLIC_SHOP_API_URL?: string;
}

export class CspConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CspConfigError';
  }
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

/**
 * Derives the WebSocket origin for an HTTP(S) API origin (http -> ws,
 * https -> wss) so the dev CSP allowlist tracks whatever port the API is
 * actually configured on, instead of a hardcoded pair of ports.
 */
function toWsOrigin(httpOrigin: string): string {
  if (httpOrigin.startsWith('https://')) {
    return `wss://${httpOrigin.slice('https://'.length)}`;
  }
  if (httpOrigin.startsWith('http://')) {
    return `ws://${httpOrigin.slice('http://'.length)}`;
  }
  return httpOrigin;
}

/**
 * Backend (NestJS) and shop-api (NestJS purchases SoT) origins.
 *
 * In production both URLs are required: silently dropping them from
 * connect-src would block every API call at runtime, so we fail loudly
 * instead (the build gate in next.config.ts turns this into a build error).
 * Localhost defaults are only ever added outside production.
 */
export function apiHosts(env: CspEnv = process.env as CspEnv): string[] {
  const hosts = new Set<string>();
  const isProduction = env.NODE_ENV === 'production';

  const backend = env.NEXT_PUBLIC_BACKEND_URL?.trim();
  const shopApi = env.NEXT_PUBLIC_SHOP_API_URL?.trim();

  if (isProduction) {
    const missing: string[] = [];
    if (!backend) missing.push('NEXT_PUBLIC_BACKEND_URL');
    if (!shopApi) missing.push('NEXT_PUBLIC_SHOP_API_URL');
    if (missing.length > 0) {
      throw new CspConfigError(
        `Missing required environment variable(s) for the production CSP connect-src: ${missing.join(
          ', ',
        )}. Set them before building.`,
      );
    }
  }

  if (backend) hosts.add(normalizeOrigin(backend));
  if (shopApi) hosts.add(normalizeOrigin(shopApi));

  // Local development defaults: the WebSocket origin is derived from each
  // HTTP API origin (http -> ws, https -> wss) so a backend configured on a
  // non-default port is not silently blocked by the CSP. The hardcoded
  // localhost:3001 / localhost:3002 pair is used only as a fallback when the
  // corresponding env var is unset in development.
  if (!isProduction) {
    const httpOrigins = [
      backend ? normalizeOrigin(backend) : 'http://localhost:3001',
      shopApi ? normalizeOrigin(shopApi) : 'http://localhost:3002',
    ];
    for (const origin of httpOrigins) {
      hosts.add(origin);
      hosts.add(toWsOrigin(origin));
    }
  }

  return Array.from(hosts);
}

export function buildConnectSrc(env: CspEnv = process.env as CspEnv): string {
  const sources = [
    "'self'",
    ...NEAR_WALLET_HOSTS,
    ...NEAR_RPC_HOSTS,
    ...apiHosts(env),
  ];
  return Array.from(new Set(sources)).join(' ');
}

// Explicit image hosts (no bare `https:` scheme). Keep in sync with
// next/image remote patterns and any external artwork sources.
const IMAGE_HOSTS = [
  'https://placehold.co',
  'https://ipfs.io',
  'https://cloudflare-ipfs.com',
  'https://gateway.pinata.cloud',
  'https://arweave.net',
];

function buildImgSrc(): string {
  return ["'self'", 'data:', ...IMAGE_HOSTS].join(' ');
}

function buildFrameSrc(): string {
  const sources = ["'self'", ...NEAR_WALLET_FRAME_HOSTS];
  return Array.from(new Set(sources)).join(' ');
}

export function buildCsp(env: CspEnv = process.env as CspEnv): string {
  return [
    "default-src 'self'",
    `connect-src ${buildConnectSrc(env)}`,
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${buildImgSrc()}`,
    "font-src 'self' data:",
    `frame-src ${buildFrameSrc()}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export const NEAR_WALLET_FRAME_ORIGINS = NEAR_WALLET_FRAME_HOSTS;

/**
 * Session cookie name per ADR-004 (httpOnly session cookie issued by the
 * backend). `auth-token` is the transitional cookie written by the legacy
    "style-src 'self' 'unsafe-inline'",
    `img-src ${buildImgSrc()}`,
    "font-src 'self' data:",
    `frame-src ${buildFrameSrc()}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export const NEAR_WALLET_FRAME_ORIGINS = NEAR_WALLET_FRAME_HOSTS;

/**
 * Session cookie name per ADR-004 (httpOnly session cookie issued by the
 * backend). `auth-token` is the transitional cookie written by the legacy
 * auth provider and is accepted only while the migration is in progress.
 */
export const SESSION_COOKIE = 'access_token';
const LEGACY_SESSION_COOKIE = 'auth-token';

/** Routes that require a session; everything else stays public. */
const PROTECTED_ROUTES = ['/settings', '/shop'];

const SIGN_IN_PATH = '/login';

function hasSession(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get(SESSION_COOKIE)?.value ||
      request.cookies.get(LEGACY_SESSION_COOKIE)?.value,
  );
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !hasSession(request)) {
    const signInUrl = new URL(SIGN_IN_PATH, request.url);
    signInUrl.searchParams.set('next', pathname);
    const redirect = NextResponse.redirect(signInUrl);
    redirect.headers.set('Content-Security-Policy', buildCsp());
    return redirect;
  }

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', buildCsp());
  return response;
}

/**
 * Build-time gate: `next build` evaluates this module, so a production build
 * without the API URLs fails here instead of shipping a CSP that blocks the API.
 */
if (process.env.NODE_ENV === 'production') {
  apiHosts();
}

/**
 * Build-time gate: `next build` evaluates this module, so a production build
 * without the API URLs fails here instead of shipping a CSP that blocks the API.
 */
if (process.env.NODE_ENV === 'production') {
  apiHosts();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
