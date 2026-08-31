import { render, screen } from "@testing-library/react";
import { expect, test, describe, vi, beforeEach } from "vitest";
import GameWaitingPage from "./page";

vi.mock("@/clients/GameWaitingClient", () => ({
  default: () => (
    <div data-testid="game-waiting-client">
      <button type="button" aria-label="Start game">Start</button>
    </div>
  ),
}));

// Mock fetchGameRoom so these a11y / format tests don't make real HTTP calls.
// The backend-validation scenarios are covered in page.backend-validation.test.tsx.
vi.mock("@/lib/api/games", () => ({
  fetchGameRoom: vi.fn().mockResolvedValue({
    found: true,
    game: {
      id: 1,
      code: "ABC123",
      status: "PENDING",
      mode: "PUBLIC",
      numberOfPlayers: 4,
    },
  }),
}));

async function renderPage(
  searchParams?: Promise<Record<string, string | string[] | undefined>>,
) {
  return render(await GameWaitingPage({ searchParams }));
}

describe("Game Waiting Page - Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-mock for each test: valid codes get a 200 response
    const { fetchGameRoom } = vi.mocked(await import("@/lib/api/games"));
    fetchGameRoom.mockResolvedValue({
      found: true,
      game: {
        id: 1,
        code: "ABC123",
        status: "PENDING",
        mode: "PUBLIC",
        numberOfPlayers: 4,
      },
    });
  });

  describe("Landmarks and ARIA", () => {
    test("renders main landmark with aria-label", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ABC123" }),
      );
      expect(
        container.querySelector('main[aria-label="Game waiting lobby"]'),
      ).toBeInTheDocument();
    });

    test("main landmark has aria-busy=true while waiting", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ABC123" }),
      );
      expect(
        container.querySelector('main[aria-busy="true"]'),
      ).toBeInTheDocument();
    });

    test("renders waiting content section with id and aria-label", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ABC123" }),
      );
      const section = container.querySelector(
        'section[aria-label="Game waiting lobby content"]',
      );
      expect(section).toBeInTheDocument();
      expect(section).toHaveAttribute("id", "game-waiting-content");
    });

    test("includes visually hidden h1 heading", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      expect(
        screen.getByRole("heading", { level: 1, name: "Waiting for Players" }),
      ).toBeInTheDocument();
    });

    test("provides aria-live status region with lobby status text", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ABC123" }),
      );
      const announcer = container.querySelector("#game-waiting-status");
      expect(announcer).toBeInTheDocument();
      expect(announcer).toHaveAttribute("role", "status");
      expect(announcer).toHaveAttribute("aria-live", "polite");
      expect(announcer).toHaveAttribute("aria-atomic", "true");
      expect(announcer).toHaveAttribute("aria-label", "Lobby status updates");
      expect(announcer?.textContent).toContain("ABC123");
    });
  });

  describe("Focus order", () => {
    test("skip link targets the waiting content section", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      const skipLink = screen.getByRole("link", { name: "Skip to waiting lobby" });
      expect(skipLink).toHaveAttribute("href", "#game-waiting-content");
    });

    test("skip link appears before main content in DOM", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      const skipLink = screen.getByRole("link", { name: "Skip to waiting lobby" });
      const startBtn = screen.getByRole("button", { name: "Start game" });
      const focusables = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      expect(focusables.indexOf(skipLink)).toBeLessThan(
        focusables.indexOf(startBtn),
      );
    });

    test("skip link has visible focus styles", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      const skipLink = screen.getByRole("link", { name: "Skip to waiting lobby" });
      expect(skipLink.className).toContain("focus:ring-2");
      expect(skipLink.className).toContain("focus:not-sr-only");
    });

    test("waiting content section applies focus-visible styles to descendants", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ABC123" }),
      );
      const section = container.querySelector("#game-waiting-content");
      expect(section?.className).toContain("focus-visible");
    });
  });

  describe("Invalid / stale state", () => {
    test("renders alert landmark when gameCode is missing", async () => {
      const { container } = await renderPage(Promise.resolve({}));
      expect(container.querySelector('main[role="alert"]')).toBeInTheDocument();
    });

    test("renders Invalid Game Code heading when gameCode is absent", async () => {
      await renderPage(Promise.resolve({}));
      expect(
        screen.getByRole("heading", { name: "Invalid Game Code" }),
      ).toBeInTheDocument();
    });

    test("renders back link to game-settings in invalid state", async () => {
      await renderPage(Promise.resolve({}));
      expect(
        screen.getByRole("link", { name: "Back to Game Settings" }),
      ).toHaveAttribute("href", "/game-settings");
    });

    test("invalid state status text describes the problem", async () => {
      const { container } = await renderPage(Promise.resolve({}));
      const status = container.querySelector('[role="status"]');
      expect(status?.textContent).toContain("Invalid or missing game code");
    });

    test("does not render waiting client in invalid state", async () => {
      await renderPage(Promise.resolve({}));
      expect(
        screen.queryByTestId("game-waiting-client"),
      ).not.toBeInTheDocument();
    });

    test("renders invalid state for malformed gameCode", async () => {
      await renderPage(Promise.resolve({ gameCode: "!@#$" }));
      expect(
        screen.getByRole("heading", { name: "Invalid Game Code" }),
      ).toBeInTheDocument();
    });

    test("renders invalid state for empty gameCode", async () => {
      await renderPage(Promise.resolve({ gameCode: "   " }));
      expect(
        screen.getByRole("heading", { name: "Invalid Game Code" }),
      ).toBeInTheDocument();
    });

    test("normalizes gameCode to uppercase", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "abc123" }),
      );
      const announcer = container.querySelector("#game-waiting-status");
      expect(announcer?.textContent).toContain("ABC123");
    });

    test("handles array gameCode param — uses first value", async () => {
      // Re-mock for XYZ789
      const { fetchGameRoom } = vi.mocked(await import("@/lib/api/games"));
      fetchGameRoom.mockResolvedValue({
        found: true,
        game: {
          id: 2,
          code: "XYZ789",
          status: "PENDING",
          mode: "PUBLIC",
          numberOfPlayers: 2,
        },
      });

      const { container } = await renderPage(
        Promise.resolve({ gameCode: ["XYZ789", "OTHER1"] }),
      );
      const announcer = container.querySelector("#game-waiting-status");
      expect(announcer?.textContent).toContain("XYZ789");
    });

    test("handles empty array gameCode as invalid", async () => {
      await renderPage(Promise.resolve({ gameCode: [] }));
      expect(
        screen.getByRole("heading", { name: "Invalid Game Code" }),
      ).toBeInTheDocument();
    });
  });
});
