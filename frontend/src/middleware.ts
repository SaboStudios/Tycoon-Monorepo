import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// MIGRATION NOTE (Next.js 16 middleware -> proxy):
// This file still uses the legacy `middleware.ts` convention (auth-gate
// redirect + CSP nonce injection via response headers). Next 16 is moving
// this responsibility toward a `proxy.ts` entrypoint. We are deferring that
// migration here rather than porting blind, because:
//   1. The nonce-in-header handoff to the root layout (see `x-nonce` below)
//      needs to keep working across whatever the new entrypoint's request/
//      response lifecycle looks like, and that needs to be verified against
//      a running app, not guessed at.
//   2. The auth-gate redirect list (`protectedRoutes`) is security-relevant;
//      an unverified rewrite of the enclosing function risks silently
//      dropping route protection.
// Once the `proxy.ts` convention and its header-mutation API are confirmed
// against this app's actual Next 16.1.2 runtime, port this logic over as a
// single, verifiable change rather than folding it into an unrelated fix.

/**
 * Generate a cryptographically secure nonce for CSP (Edge-compatible)
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Next.js middleware that protects dashboard and game routes.
 *
 * Authentication is checked via the `auth-token` cookie, which is set by
 * the auth provider (`src/context/auth-provider.tsx`, line 96) as:
 *
 *   document.cookie = `auth-token=${accessToken}; path=/; max-age=3600; SameSite=Lax`;
 *
 * When a request targets a protected route and the `auth-token` cookie is
 * missing, the user is redirected to `/login`. All responses also receive
 * a CSP nonce via the `x-nonce` header.
 */
export function middleware(request: NextRequest) {
  /** Cookie name used for authentication — must match auth-provider.tsx */
  const AUTH_COOKIE_NAME = "auth-token";

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;

  // Protected routes
  const protectedRoutes = [
    "/game-play",
    "/ai-play",
    "/game-settings",
    "/join-room",
    "/play-ai",
    // Demo of an in-game feature — keep it behind the same auth gate as the
    // real game routes (it is also flag-gated + 404s in prod, see
    // app/trade-demo/page.tsx).
    "/trade-demo",
  ];

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !token) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  const nonce = generateNonce();
  const response = NextResponse.next();
  response.headers.set("x-nonce", nonce);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
