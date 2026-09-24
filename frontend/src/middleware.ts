import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const { pathname } = request.nextUrl;

  // Protected routes
  const protectedRoutes = ["/game-play", "/ai-play", "/game-settings", "/join-room", "/play-ai"];

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !token) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // Generate nonce for CSP
  const nonce = generateNonce();
  const response = NextResponse.next();

  // Store nonce in response headers for use in layout
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
