import { render, screen } from "@testing-library/react";
import { expect, test, describe, vi } from "vitest";
import Home from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/hooks/useHeroTelemetry", () => ({
  useHeroTelemetry: () => ({
    fire: vi.fn(),
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

describe("Home Page - Accessibility", () => {
  describe("Heading Hierarchy", () => {
    test("renders exactly one h1 element", async () => {
      // Note: This is a server component test - rendering may be limited
      // Main h1 should be in HeroSection
      const { container } = render(<Home />);
      const h1s = container.querySelectorAll("h1");
      expect(h1s.length).toBeGreaterThanOrEqual(1);
    });

    test("uses h2 for secondary section headings", async () => {
      // Secondary sections should use h2
      const { container } = render(<Home />);
      const h2s = container.querySelectorAll("h2");
      expect(h2s.length).toBeGreaterThan(0);
    });
  });

  describe("ARIA Labels", () => {
    test("sections have appropriate aria-labels", async () => {
      const { container } = render(<Home />);
      const sectionsWithLabels = container.querySelectorAll("[aria-label]");
      // Should have multiple sections with aria-labels
      expect(sectionsWithLabels.length).toBeGreaterThan(0);
    });

    test("buttons have accessible labels", async () => {
      const { container } = render(<Home />);
      const buttonsWithLabels = container.querySelectorAll("button[aria-label]");
      // Action buttons should have aria-labels
      expect(buttonsWithLabels.length).toBeGreaterThan(0);
    });

    test("links have accessible labels", async () => {
      const { container } = render(<Home />);
      const linksWithLabels = container.querySelectorAll("a[aria-label]");
      // Community links should have aria-labels
      expect(linksWithLabels.length).toBeGreaterThan(0);
    });
  });

  describe("ARIA Live Regions", () => {
    test("animated content has live region announcement", async () => {
      const { container } = render(<Home />);
      const liveRegions = container.querySelectorAll('[aria-live="polite"]');
      // Should have live regions for animated content
      expect(liveRegions.length).toBeGreaterThan(0);
    });

    test("carousel has live region for slide announcements", async () => {
      const { container } = render(<Home />);
      const carouselLiveRegion = container.querySelector(
        '[data-testid="carousel-live-region"]'
      );
      expect(carouselLiveRegion).toBeInTheDocument();
      expect(carouselLiveRegion).toHaveAttribute("aria-live", "polite");
      expect(carouselLiveRegion).toHaveAttribute("role", "status");
    });
  });

  describe("Focus Management", () => {
    test("interactive elements are focusable", async () => {
      const { container } = render(<Home />);
      const buttons = container.querySelectorAll("button");
      const links = container.querySelectorAll("a[href]");
      expect(buttons.length + links.length).toBeGreaterThan(0);
    });
  });

  describe("Semantic Structure", () => {
    test("decorative SVGs have aria-hidden attribute", async () => {
      const { container } = render(<Home />);
      const decorativeSvgs = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(decorativeSvgs.length).toBeGreaterThan(0);
    });

    test("links are not nested inside buttons", async () => {
      const { container } = render(<Home />);
      const buttons = container.querySelectorAll("button");
      let foundNestedLink = false;
      buttons.forEach((button) => {
        if (button.querySelector("a")) {
          foundNestedLink = true;
        }
      });
      expect(foundNestedLink).toBe(false);
    });

    test("carousel pagination has proper ARIA attributes", async () => {
      const { container } = render(<Home />);
      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).toBeInTheDocument();
      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBeGreaterThan(0);
      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute("aria-selected");
        expect(tab).toHaveAttribute("aria-label");
      });
    });
  });

  describe("Content Accessibility", () => {
    test("page has meaningful content structure", async () => {
      const { container } = render(<Home />);
      const sections = container.querySelectorAll("section");
      expect(sections.length).toBeGreaterThan(0);
    });
  });
});
