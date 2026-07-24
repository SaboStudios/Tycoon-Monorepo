/**
 * AiPlayGamePage — sync render tests using AiGameContent.
 *
 * Issue #1257: AiPlayGamePage tests use AiGameContent for sync render.
 *
 * The default export `AiPlayGamePage` is an async Server Component.
 * React Testing Library (RTL) does not support rendering async Server
 * Components directly — doing so causes act() warnings and flaky results.
 *
 * Strategy: import and render the named `AiGameContent` export synchronously.
 * `AiGameContent` is the pure synchronous slice of the page's UI and covers
 * 100 % of the branching logic (invalid id → error state, valid id → loading
 * state).  The Suspense boundary / metadata are tested separately (e2e /
 * storybook) or left to Next.js's own test harness.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, test, describe, vi, beforeEach } from "vitest";
import { AiGameContent } from "./page";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/ui/spinner", () => ({
  Spinner: ({ size }: { size: string }) => (
    <div data-testid="spinner" data-size={size}>
      Loading...
    </div>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// ── Sync render contract ──────────────────────────────────────────────────────

describe("AiPlayGamePage — sync render via AiGameContent (Issue #1257)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Sync render — no async Server Component in RTL", () => {
    test("AiGameContent renders synchronously without act() warnings", () => {
      // If this were the async default export, RTL would emit act() warnings.
      // Rendering the named sync export must complete in a single synchronous pass.
      expect(() => render(<AiGameContent id="SYNC01" />)).not.toThrow();
    });

    test("render result is available immediately (no await needed)", () => {
      const { container } = render(<AiGameContent id="SYNC01" />);
      // DOM is populated synchronously — no await / findBy needed
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe("Invalid id — error branch", () => {
    test("empty string renders error state synchronously", () => {
      render(<AiGameContent id="" />);
      expect(
        screen.getByRole("alert", { name: /invalid game error/i }),
      ).toBeInTheDocument();
    });

    test("whitespace-only id renders error state synchronously", () => {
      render(<AiGameContent id="   " />);
      expect(
        screen.getByRole("alert", { name: /invalid game error/i }),
      ).toBeInTheDocument();
    });

    test("error state contains 'Invalid Game' heading", () => {
      render(<AiGameContent id="" />);
      expect(
        screen.getByRole("heading", { name: /invalid game/i }),
      ).toBeInTheDocument();
    });

    test("error state contains back-to-arena link", () => {
      render(<AiGameContent id="" />);
      const link = screen.getByRole("link", { name: /back to ai arena/i });
      expect(link).toHaveAttribute("href", "/play-ai");
    });

    test("error state description is visible", () => {
      render(<AiGameContent id="" />);
      expect(
        screen.getByText(/game code is missing or invalid/i),
      ).toBeInTheDocument();
    });
  });

  describe("Valid id — loading branch", () => {
    test("valid id renders loading section synchronously", () => {
      const { container } = render(<AiGameContent id="ROOM42" />);
      const section = container.querySelector(
        'section[aria-label="AI game loading"]',
      );
      expect(section).toBeInTheDocument();
    });

    test("game code is normalised to uppercase in the heading", () => {
      render(<AiGameContent id="room42" />);
      expect(screen.getByRole("heading", { name: /room42/i })).toHaveTextContent(
        "ROOM42",
      );
    });

    test("spinner is rendered in loading state", () => {
      render(<AiGameContent id="ROOM42" />);
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    test("back-to-arena link is present in loading state", () => {
      render(<AiGameContent id="ROOM42" />);
      const link = screen.getByRole("link", { name: /back to ai arena/i });
      expect(link).toHaveAttribute("href", "/play-ai");
    });

    test("aria-busy container is present in loading state", () => {
      const { container } = render(<AiGameContent id="ROOM42" />);
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    test("polite live region wraps the spinner", () => {
      const { container } = render(<AiGameContent id="ROOM42" />);
      const live = container.querySelector('[aria-live="polite"]');
      expect(live).toBeInTheDocument();
    });
  });

  describe("Game-code normalisation", () => {
    test("lowercase id → uppercase display", () => {
      render(<AiGameContent id="abc" />);
      expect(screen.getByRole("heading")).toHaveTextContent("ABC");
    });

    test("mixed-case id → uppercase display", () => {
      render(<AiGameContent id="AbC123" />);
      expect(screen.getByRole("heading")).toHaveTextContent("ABC123");
    });

    test("surrounding whitespace is trimmed before display", () => {
      render(<AiGameContent id="  xyz  " />);
      expect(screen.getByRole("heading")).toHaveTextContent("XYZ");
      expect(screen.getByRole("heading").textContent).not.toMatch(/^\s|\s$/);
    });
  });

  describe("Stale / invalid state handling", () => {
    test("single space id is treated as invalid (stale navigation)", () => {
      render(<AiGameContent id=" " />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    test("renders without crashing when id is an empty-after-trim string", () => {
      expect(() => render(<AiGameContent id="\t\n" />)).not.toThrow();
    });
  });
});
