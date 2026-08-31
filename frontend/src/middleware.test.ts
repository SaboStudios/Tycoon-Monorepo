import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * Minimal mock of the Headers-like object returned by NextResponse so we can
 * assert that the middleware sets the `x-nonce` header.
 */
class MockHeaders {
  private store = new Map<string, string>();
  set(key: string, value: string) {
    this.store.set(key.toLowerCase(), value);
  }
  get(key: string) {
    return this.store.get(key.toLowerCase());
  }
}

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: URL) => ({
      type: "redirect" as const,
      url,
      headers: new MockHeaders(),
    }),
    next: () => ({
      type: "next" as const,
      headers: new MockHeaders(),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake NextRequest with optional cookies. */
function buildRequest(
  path: string,
  cookies: Record<string, string> = {},
): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  return {
    cookies: {
      get: (name: string) => {
        const value = cookies[name];
        return value !== undefined ? { name, value } : undefined;
      },
    },
    nextUrl: url,
    url: url.toString(),
  } as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

// Import after mocks are in place
import { middleware, config } from "./middleware";

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub crypto.getRandomValues so nonce generation is deterministic in tests
    vi.stubGlobal("crypto", {
      getRandomValues: (buf: Uint8Array) => {
        for (let i = 0; i < buf.length; i++) buf[i] = i;
        return buf;
      },
    });
  });

  // -----------------------------------------------------------------------
  // Protected routes WITHOUT auth-token cookie  -->  redirect to /login
  // -----------------------------------------------------------------------
  const protectedRoutes = [
    "/game-play",
    "/ai-play",
    "/game-settings",
    "/join-room",
    "/play-ai",
    "/trade-demo",
  ];

  describe("protected routes without auth-token cookie", () => {
    it.each(protectedRoutes)(
      "redirects %s to /login when auth-token cookie is missing",
      (route) => {
        const req = buildRequest(route);
        const res = middleware(req) as any;

        expect(res.type).toBe("redirect");
        expect(res.url.pathname).toBe("/login");
      },
    );

    it("redirects sub-paths of protected routes (e.g. /game-play/123)", () => {
      const req = buildRequest("/game-play/room-abc");
      const res = middleware(req) as any;

      expect(res.type).toBe("redirect");
      expect(res.url.pathname).toBe("/login");
    });
  });

  // -----------------------------------------------------------------------
  // Protected routes WITH auth-token cookie  -->  pass through
  // -----------------------------------------------------------------------
  describe("protected routes with auth-token cookie", () => {
    it.each(protectedRoutes)(
      "allows %s when auth-token cookie is present",
      (route) => {
        const req = buildRequest(route, { "auth-token": "valid-jwt-token" });
        const res = middleware(req) as any;

        expect(res.type).toBe("next");
      },
    );
  });

  // -----------------------------------------------------------------------
  // Public routes  -->  always pass through
  // -----------------------------------------------------------------------
  const publicRoutes = ["/", "/login", "/shop", "/about", "/leaderboard"];

  describe("public routes", () => {
    it.each(publicRoutes)(
      "allows %s without auth-token cookie",
      (route) => {
        const req = buildRequest(route);
        const res = middleware(req) as any;

        expect(res.type).toBe("next");
      },
    );
  });

  // -----------------------------------------------------------------------
  // CSP nonce header
  // -----------------------------------------------------------------------
  describe("x-nonce header", () => {
    it("sets x-nonce header on public route responses", () => {
      const req = buildRequest("/");
      const res = middleware(req) as any;

      expect(res.headers.get("x-nonce")).toBeDefined();
      expect(typeof res.headers.get("x-nonce")).toBe("string");
      expect((res.headers.get("x-nonce") as string).length).toBeGreaterThan(0);
    });

    it("sets x-nonce header on authenticated protected route responses", () => {
      const req = buildRequest("/game-play", {
        "auth-token": "valid-jwt-token",
      });
      const res = middleware(req) as any;

      expect(res.headers.get("x-nonce")).toBeDefined();
      expect(typeof res.headers.get("x-nonce")).toBe("string");
      expect((res.headers.get("x-nonce") as string).length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Matcher config
  // -----------------------------------------------------------------------
  describe("config.matcher", () => {
    it("exports a matcher that excludes api, _next/static, _next/image, and favicon.ico", () => {
      expect(config.matcher).toBeDefined();
      expect(config.matcher).toContain(
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
      );
    });
  });
});
