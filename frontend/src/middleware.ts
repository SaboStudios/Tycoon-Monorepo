import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  const protectedRoutes = [
    "/game-play",
    "/ai-play",
    "/game-settings",
    "/join-room",
    "/play-ai",
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
