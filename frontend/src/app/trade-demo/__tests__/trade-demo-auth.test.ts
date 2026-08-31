import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Auth parity verification: /trade-demo vs /play-ai
 *
 * Both routes are protected by the same middleware auth gate in
 * frontend/src/middleware.ts. This test suite verifies that /trade-demo
 * receives identical authentication treatment to /play-ai.
 *
 * The middleware protectedRoutes array gates both paths:
 *   - /play-ai
 *   - /trade-demo
 *
 * Unauthenticated requests (no auth-token cookie) are redirected to /login.
 *
 * Note: /trade-demo is also feature-flag gated via isTradeDemoEnabled()
 * in the page component. When the flag is disabled, the page returns 404
 * (via notFound()) even for authenticated users. This is an additional
 * layer on top of the middleware auth gate documented here.
 */

// Dynamic import so we can test the real middleware function
const importMiddleware = async () => {
  const mod = await import("@/middleware");
  return mod.middleware;
};

/**
 * Helper to build a NextRequest targeting a specific path,
 * optionally including an auth-token cookie.
 */
function buildRequest(
  path: string,
  options?: { authToken?: string }
): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  const request = new NextRequest(url);
  if (options?.authToken) {
    request.cookies.set("auth-token", options.authToken);
  }
  return request;
}

describe("/trade-demo auth parity with /play-ai", () => {
  let middleware: Awaited<ReturnType<typeof importMiddleware>>;

  beforeEach(async () => {
    middleware = await importMiddleware();
  });

  it("redirects unauthenticated users from /trade-demo to /login", () => {
    const request = buildRequest("/trade-demo");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(
      new URL(response.headers.get("location")!, "http://localhost:3000")
        .pathname
    ).toBe("/login");
  });

  it("redirects unauthenticated users from /play-ai to /login", () => {
    const request = buildRequest("/play-ai");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(
      new URL(response.headers.get("location")!, "http://localhost:3000")
        .pathname
    ).toBe("/login");
  });

  it("applies identical redirect behavior for /trade-demo and /play-ai", () => {
    const tradeDemoReq = buildRequest("/trade-demo");
    const playAiReq = buildRequest("/play-ai");

    const tradeDemoRes = middleware(tradeDemoReq);
    const playAiRes = middleware(playAiReq);

    // Both should redirect with the same status
    expect(tradeDemoRes.status).toBe(playAiRes.status);

    // Both should redirect to /login
    const tradeDemoLocation = new URL(
      tradeDemoRes.headers.get("location")!,
      "http://localhost:3000"
    ).pathname;
    const playAiLocation = new URL(
      playAiRes.headers.get("location")!,
      "http://localhost:3000"
    ).pathname;

    expect(tradeDemoLocation).toBe("/login");
    expect(playAiLocation).toBe("/login");
    expect(tradeDemoLocation).toBe(playAiLocation);
  });

  it("allows authenticated users to access /trade-demo", () => {
    const request = buildRequest("/trade-demo", {
      authToken: "valid-token-123",
    });
    const response = middleware(request);

    // Should not redirect - status 200 means NextResponse.next()
    expect(response.status).toBe(200);
  });

  it("allows authenticated users to access /play-ai", () => {
    const request = buildRequest("/play-ai", {
      authToken: "valid-token-123",
    });
    const response = middleware(request);

    expect(response.status).toBe(200);
  });

  it("protects /trade-demo sub-paths (e.g. /trade-demo/history)", () => {
    const request = buildRequest("/trade-demo/history");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(
      new URL(response.headers.get("location")!, "http://localhost:3000")
        .pathname
    ).toBe("/login");
  });
});
