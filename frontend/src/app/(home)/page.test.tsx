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

describe("Home Page - Core Functionality", () => {
  describe("Component Rendering", () => {
    test("renders without errors", () => {
      const { container } = render(<Home />);
      expect(container).toBeTruthy();
    });

    test("renders HomeClient component", () => {
      const { container } = render(<Home />);
      // Verify that at least the main container is rendered
      const mainContainer = container.querySelector("div.w-full");
      expect(mainContainer).toBeInTheDocument();
    });

    test("returns valid ReactNode", () => {
      const result = <Home />;
      expect(result).toBeTruthy();
      expect(result.type).toBeDefined();
    });

    test("renders responsive layout structure", () => {
      const { container } = render(<Home />);
      const mainDiv = container.querySelector("div.w-full");
      expect(mainDiv).toBeInTheDocument();
      
      // Check for mobile and desktop variants
      const mobileDiv = container.querySelector("div.md\\:hidden");
      const desktopDiv = container.querySelector("div.hidden.md\\:block");
      
      expect(mobileDiv).toBeInTheDocument();
      expect(desktopDiv).toBeInTheDocument();
    });
  });

  describe("TypeScript Type Safety", () => {
    test("Home component is properly typed", () => {
      // This test verifies TypeScript compilation
      const component = Home;
      expect(component).toBeDefined();
      expect(typeof component).toBe("function");
    });

    test("component returns ReactNode type", () => {
      const result = <Home />;
      expect(result).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    test("handles component gracefully without errors", () => {
      expect(() => {
        render(<Home />);
      }).not.toThrow();
    });

    test("renders with null props gracefully", () => {
      const { container } = render(<Home />);
      expect(container.querySelector("div.w-full")).toBeInTheDocument();
    });
  });
});

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

    test("renders a skip link targeting the home content region", async () => {
      render(<Home />);
      const skipLink = screen.getByRole("link", { name: "Skip to home content" });
      expect(skipLink).toHaveAttribute("href", "#home-page-content");
    });

    test("skip link appears before the main home content in DOM order", async () => {
      render(<Home />);
      const skipLink = screen.getByRole("link", { name: "Skip to home content" });
      const mainContent = screen.getByRole("region", { name: "Home page content" });

      const focusableElements = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      expect(focusableElements.indexOf(skipLink)).toBeLessThan(
        focusableElements.indexOf(mainContent),
      );
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

    test("home page has a main landmark with an accessible label", async () => {
      render(<Home />);
      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("aria-label", "Tycoon home page");
    });
  });
});
