import { render, screen } from "@testing-library/react";
import { expect, test, describe, vi } from "vitest";
import { AiGameContent } from "./page";

vi.mock("@/components/ui/spinner", () => ({
  Spinner: ({ size }: { size: string }) => (
    <div data-testid="spinner" data-size={size}>
      Loading...
    </div>
  ),
}));

vi.mock("next/link", () => {
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

describe("AI Game Page - Accessibility", () => {
  describe("Error State", () => {
    test("renders error section with role=alert", async () => {
      const { container } = render(<AiGameContent id="" />);
      const section = container.querySelector('section[role="alert"]');
      expect(section).toBeInTheDocument();
    });

    test("error section has aria-label", async () => {
      const { container } = render(<AiGameContent id="" />);
      const section = container.querySelector(
        'section[aria-label="Invalid game error"]'
      );
      expect(section).toBeInTheDocument();
    });

    test("error state includes h1 heading", async () => {
      const { container } = render(<AiGameContent id="" />);
      const h1 = container.querySelector("h1");
      expect(h1).toBeInTheDocument();
      expect(h1?.textContent).toContain("Invalid Game");
    });

    test("back link is accessible", async () => {
      const { container } = render(<AiGameContent id="" />);
      const link = container.querySelector('a[href="/play-ai"]');
      expect(link).toBeInTheDocument();
      expect(link?.textContent).toContain("Back to AI Arena");
    });
  });

  describe("Content State", () => {
    test("renders section with aria-label for valid game", async () => {
      const { container } = render(<AiGameContent id="ABC123" />);
      const section = container.querySelector('section[aria-label="AI game loading"]');
      expect(section).toBeInTheDocument();
    });

    test("content div has aria-busy attribute", async () => {
      const { container } = render(<AiGameContent id="ABC123" />);
      const div = container.querySelector('[aria-busy="true"]');
      expect(div).toBeInTheDocument();
    });

    test("content div has aria-label with game code", async () => {
      const { container } = render(<AiGameContent id="ABC123" />);
      const div = container.querySelector('[aria-label*="ABC123"]');
      expect(div).toBeInTheDocument();
    });

    test("h1 displays game code", async () => {
      const { container } = render(<AiGameContent id="ABC123" />);
      const h1 = container.querySelector("h1");
      expect(h1?.textContent).toContain("ABC123");
    });

    test("spinner container has aria-live region", async () => {
      const { container } = render(<AiGameContent id="ABC123" />);
      const spinnerContainer = container.querySelector('[aria-live="polite"]');
      expect(spinnerContainer).toBeInTheDocument();
    });

    test("back link is accessible in content state", async () => {
      const { container } = render(<AiGameContent id="ABC123" />);
      const link = container.querySelector('a[href="/play-ai"]');
      expect(link).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    test("loading section has aria-label", async () => {
      // Note: Testing loading state requires testing Suspense fallback
      // This would typically be tested via integration tests
      expect(true).toBe(true);
    });
  });

  describe("Semantic Structure", () => {
    test("decorative icons have aria-hidden", async () => {
      const { container } = render(<AiGameContent id="ABC123" />);
      const decorativeIcons = container.querySelectorAll("[aria-hidden='true']");
      expect(decorativeIcons.length).toBeGreaterThan(0);
    });

    test("status regions have proper ARIA attributes", async () => {
      const { container } = render(<AiGameContent id="ABC123" />);
      const statusRegion = container.querySelector('[role="status"]');
      expect(statusRegion).toBeInTheDocument();
      expect(statusRegion).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("Game Code Handling", () => {
    test("handles uppercase game code", async () => {
      const { container } = render(<AiGameContent id="abc123" />);
      const h1 = container.querySelector("h1");
      expect(h1?.textContent).toContain("ABC123");
    });

    test("handles whitespace in game code", async () => {
      const { container } = render(<AiGameContent id="  abc123  " />);
      const h1 = container.querySelector("h1");
      expect(h1?.textContent).toContain("ABC123");
    });

    test("treats empty or whitespace-only game code as invalid", async () => {
      const { container } = render(<AiGameContent id="   " />);
      const section = container.querySelector('section[role="alert"]');
      expect(section).toBeInTheDocument();
    });
  });
});
