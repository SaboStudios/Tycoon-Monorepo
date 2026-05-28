import { render, screen } from "@testing-library/react";
import { expect, test, describe, vi } from "vitest";
import GameSettingsPage from "./page";

vi.mock("@/clients/GameSettingsClient", () => ({
  default: () => (
    <div data-testid="game-settings-client">
      <button type="button">Create Lobby</button>
    </div>
  ),
}));

describe("Game Settings Page - Accessibility", () => {
  describe("Landmarks and ARIA", () => {
    test("renders main landmark with aria-label", () => {
      const { container } = render(<GameSettingsPage />);
      const main = container.querySelector('main[aria-label="Game settings"]');
      expect(main).toBeInTheDocument();
    });

    test("renders settings content section with id and aria-label", () => {
      const { container } = render(<GameSettingsPage />);
      const section = container.querySelector(
        'section[aria-label="Game settings form"]',
      );
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute("id", "game-settings-content");
    });

    test("includes visually hidden h1 heading", () => {
      render(<GameSettingsPage />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Game Settings" }),
      ).toBeInTheDocument();
    });

    test("provides aria-live status region", () => {
      const { container } = render(<GameSettingsPage />);
      const announcer = container.querySelector("#game-settings-status");
      expect(announcer).toBeInTheDocument();
      expect(announcer).toHaveAttribute("role", "status");
      expect(announcer).toHaveAttribute("aria-live", "polite");
      expect(announcer).toHaveAttribute("aria-atomic", "true");
      expect(announcer).toHaveAttribute("aria-label", "Game settings status");
    });
  });

  describe("Focus order", () => {
    test("skip link targets the settings content section", () => {
      render(<GameSettingsPage />);
      const skipLink = screen.getByRole("link", {
        name: "Skip to game settings",
      });
      expect(skipLink).toHaveAttribute("href", "#game-settings-content");
    });

    test("skip link appears before main content in DOM", () => {
      render(<GameSettingsPage />);
      const skipLink = screen.getByRole("link", {
        name: "Skip to game settings",
      });
      const createLobbyBtn = screen.getByRole("button", {
        name: "Create Lobby",
      });
      const focusables = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      expect(focusables.indexOf(skipLink)).toBeLessThan(
        focusables.indexOf(createLobbyBtn),
      );
    });

    test("skip link has visible focus styles", () => {
      render(<GameSettingsPage />);
      const skipLink = screen.getByRole("link", {
        name: "Skip to game settings",
      });
      expect(skipLink.className).toContain("focus:ring-2");
      expect(skipLink.className).toContain("focus:not-sr-only");
    });

    test("settings content section applies focus-visible styles to descendants", () => {
      const { container } = render(<GameSettingsPage />);
      const section = container.querySelector("#game-settings-content");
      expect(section?.className).toContain("focus-visible");
    });
  });

  describe("Client component", () => {
    test("renders the game settings client inside the section", () => {
      render(<GameSettingsPage />);
      expect(screen.getByTestId("game-settings-client")).toBeInTheDocument();
    });
  });
});
