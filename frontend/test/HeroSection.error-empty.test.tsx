/**
 * SW-FE-005: Landing hero — error and empty states.
 *
 * Tests that HeroSection gracefully handles error states and empty content
 * scenarios without crashing or exposing sensitive information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockTrack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

vi.mock("@/lib/errors", () => ({
  sanitizeError: (err: unknown) => ({
    userMessage: err instanceof Error ? err.message : "An unexpected error occurred",
    category: "unknown",
    recoverable: true,
  }),
}));

vi.mock("react-type-animation", () => ({
  TypeAnimation: (props: { className?: string }) => (
    <span data-testid="hero-animated-copy" className={props.className}>mocked animation</span>
  ),
}));

import HeroSection from "@/components/guest/HeroSection";

describe("HeroSection — SW-FE-005: Error and empty states", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockTrack.mockClear();
  });

  describe("Error state", () => {
    it("renders error UI when navigation throws", () => {
      // Make router.push throw
      mockPush.mockImplementationOnce(() => {
        throw new Error("Navigation failed");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      fireEvent.click(continueBtn);

      // Should show error state
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Navigation failed")).toBeInTheDocument();
    });

    it("renders error UI with generic message for non-Error throws", () => {
      mockPush.mockImplementationOnce(() => {
        throw "string error";
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      fireEvent.click(continueBtn);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
    });

    it("error state has role='alert' for screen readers", () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("fail");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      fireEvent.click(continueBtn);

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("error state shows a Try Again button that resets the error", () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("fail");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      fireEvent.click(continueBtn);

      // Error state visible
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Click Try Again
      const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(tryAgainBtn);

      // Should return to normal state
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();
    });

    it("does not expose stack traces in error messages", () => {
      const errorWithStack = new Error("fail");
      errorWithStack.stack = "Error: fail\n    at Object.<anonymous> (test.ts:1:1)";

      mockPush.mockImplementationOnce(() => {
        throw errorWithStack;
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      fireEvent.click(continueBtn);

      // Stack trace should not be visible
      expect(screen.queryByText(/at Object/)).not.toBeInTheDocument();
      expect(screen.queryByText(/test\.ts/)).not.toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("renders normally when there is no error (happy path)", () => {
      render(<HeroSection />);
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();
      expect(screen.getByTestId("hero-primary-cta")).toBeInTheDocument();
      expect(screen.getByText("Welcome back, Player!")).toBeInTheDocument();
    });

    it("all buttons are functional in normal state", () => {
      render(<HeroSection />);
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(4);
      buttons.forEach((btn) => {
        expect(btn).not.toBeDisabled();
      });
    });
  });
});
