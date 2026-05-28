/**
 * SW-FE-008: MSW handlers for the Landing Hero section.
 *
 * These handlers provide mock API responses for hero-related endpoints,
 * ensuring parity between MSW fixtures and the actual API contract.
 */

import { http, HttpResponse } from "msw";
import { mockHeroContent, mockHeroContentEmpty, mockHeroApiError } from "../fixtures/hero";

export const heroHandlers = [
  // GET /api/hero/content — fetch hero content and allow fixture overrides for empty/error states
  http.get("*/api/hero/content", ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get("error") === "true") {
      return HttpResponse.json(mockHeroApiError, { status: 500 });
    }

    if (url.searchParams.get("empty") === "true") {
      return HttpResponse.json(mockHeroContentEmpty, { status: 200 });
    }

    return HttpResponse.json(mockHeroContent, { status: 200 });
  }),

  // GET /api/hero/announcements — fetch active announcements
  http.get("*/api/hero/announcements", () => {
    return HttpResponse.json({
      data: mockHeroContent.announcements,
      total: mockHeroContent.announcements.length,
    });
  }),

  // GET /api/hero/features — fetch hero feature cards
  http.get("*/api/hero/features", () => {
    return HttpResponse.json({
      data: mockHeroContent.features,
      total: mockHeroContent.features.length,
    });
  }),
];
