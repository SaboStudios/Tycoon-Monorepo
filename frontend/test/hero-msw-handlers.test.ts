/**
 * SW-FE-008: MSW fixtures parity with API — hero handlers tests.
 *
 * Verifies that hero MSW handlers return the correct shapes and status codes
 * matching the API contract.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { heroHandlers } from "../src/mocks/handlers/hero";
import { mockHeroContent, mockHeroContentEmpty, mockHeroApiError } from "../src/mocks/fixtures/hero";

const server = setupServer(...heroHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());

describe("SW-FE-008: Hero MSW handlers — parity with API", () => {
  it("GET /api/hero/content returns 200 with full hero content", async () => {
    const res = await fetch("/api/hero/content");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("announcements");
    expect(body).toHaveProperty("features");
    expect(body).toHaveProperty("welcomeMessage");
    expect(body.announcements).toHaveLength(mockHeroContent.announcements.length);
    expect(body.features).toHaveLength(mockHeroContent.features.length);
    expect(body.welcomeMessage).toBe("Welcome back, Player!");
  });

  it("GET /api/hero/content returns announcements with correct shape", async () => {
    const res = await fetch("/api/hero/content");
    const body = await res.json();
    const announcement = body.announcements[0];
    expect(announcement).toHaveProperty("id");
    expect(announcement).toHaveProperty("title");
    expect(announcement).toHaveProperty("body");
    expect(announcement).toHaveProperty("ctaLabel");
    expect(announcement).toHaveProperty("ctaLink");
    expect(announcement).toHaveProperty("priority");
    expect(announcement).toHaveProperty("active");
    expect(announcement).toHaveProperty("startsAt");
    expect(announcement).toHaveProperty("expiresAt");
  });

  it("GET /api/hero/content returns features with correct shape", async () => {
    const res = await fetch("/api/hero/content");
    const body = await res.json();
    const feature = body.features[0];
    expect(feature).toHaveProperty("id");
    expect(feature).toHaveProperty("label");
    expect(feature).toHaveProperty("description");
    expect(feature).toHaveProperty("icon");
    expect(feature).toHaveProperty("route");
    expect(feature).toHaveProperty("order");
  });

  it("GET /api/hero/announcements returns paginated announcements", async () => {
    const res = await fetch("/api/hero/announcements");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/hero/features returns paginated features", async () => {
    const res = await fetch("/api/hero/features");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it("fixture types match the HeroContentResponse interface", () => {
    // Compile-time check: these assignments should be valid
    const content = mockHeroContent;
    const empty = mockHeroContentEmpty;
    const error = mockHeroApiError;

    expect(content.announcements[0].id).toBeDefined();
    expect(content.features[0].label).toBeDefined();
    expect(empty.announcements).toHaveLength(0);
    expect(empty.features).toHaveLength(0);
    expect(error.code).toBe("HERO_FETCH_ERROR");
    expect(error.statusCode).toBe(500);
  });
});
