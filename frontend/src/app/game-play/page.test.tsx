import { render, screen } from "@testing-library/react";
import { expect, test, describe, vi } from "vitest";
import GamePlayPage from "./page";

vi.mock("@/components/game/GameBoard", () => ({
  default: () => (
    <div data-testid="game-board" role="grid" tabIndex={0} aria-label="Game board">
      <button type="button" aria-label="Open inventory">
        Inventory
      </button>
      <button type="button" aria-label="Open shop">
        Shop
      </button>
    </div>
  ),
}));

describe("Game Play Page - Accessibility", () => {
  describe("Landmarks and ARIA", () => {
    test("renders main landmark with aria-label", () => {
      const { container } = render(<GamePlayPage />);
      const main = container.querySelector('main[aria-label="Tycoon game play"]');
      expect(main).toBeInTheDocument();
    });

    test("renders game board region with aria-label", () => {
      const { container } = render(<GamePlayPage />);
      const region = container.querySelector(
        'section[aria-label="Game board area"]',
      );
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute("id", "game-board-region");
    });

    test("includes visually hidden h1 heading", () => {
      render(<GamePlayPage />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Game Play" }),
      ).toBeInTheDocument();
    });

    test("provides aria-live region for game status updates", () => {
      const { container } = render(<GamePlayPage />);
      const announcer = container.querySelector("#game-status-announcer");
      expect(announcer).toBeInTheDocument();
      expect(announcer).toHaveAttribute("role", "status");
      expect(announcer).toHaveAttribute("aria-live", "polite");
      expect(announcer).toHaveAttribute("aria-atomic", "true");
      expect(announcer).toHaveAttribute("aria-label", "Game status updates");
    });
  });

  describe("Focus order", () => {
    test("skip link targets the game board region", () => {
      render(<GamePlayPage />);
      const skipLink = screen.getByRole("link", { name: "Skip to game board" });
      expect(skipLink).toHaveAttribute("href", "#game-board-region");
    });

    test("tab order is: skip link → game board → board controls", () => {
      render(<GamePlayPage />);
      const skipLink = screen.getByRole("link", { name: "Skip to game board" });
      const board = screen.getByTestId("game-board");
      const inventory = screen.getByRole("button", { name: "Open inventory" });
      const shop = screen.getByRole("button", { name: "Open shop" });

      const focusables = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      expect(focusables.indexOf(skipLink)).toBeLessThan(focusables.indexOf(board));
      expect(focusables.indexOf(board)).toBeLessThan(focusables.indexOf(inventory));
      expect(focusables.indexOf(inventory)).toBeLessThan(focusables.indexOf(shop));
    });

    test("skip link is keyboard focusable with visible focus styles", () => {
      render(<GamePlayPage />);
      const skipLink = screen.getByRole("link", { name: "Skip to game board" });
      expect(skipLink.className).toContain("focus:ring-2");
      expect(skipLink.className).toContain("focus:not-sr-only");
    });

    test("game board region applies focus-visible styles to descendants", () => {
      const { container } = render(<GamePlayPage />);
      const region = container.querySelector("#game-board-region");
      expect(region?.className).toContain("focus-visible");
    });
  });
});
