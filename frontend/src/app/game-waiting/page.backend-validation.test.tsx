/**
 * #1479 game-waiting — backend validation tests
 *
 * Verifies that GameWaitingPage validates game codes against the backend
 * before rendering the waiting-room UI:
 *   - Unknown code (backend 404) → "Room Not Found" UI, no countdown
 *   - Valid code (backend 200)   → waiting lobby UI
 *   - Network error              → graceful degradation (show lobby)
 *   - Rate-limited (429)         → graceful degradation (show lobby)
 *   - Invalid format             → "Invalid Game Code" UI (no backend call)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import GameWaitingPage from "./page";

// ─── Mock the GameWaitingClient so tests don't need the full component tree ──

vi.mock("@/clients/GameWaitingClient", () => ({
  default: () => (
    <div data-testid="game-waiting-client">
      <button type="button" aria-label="Start game">Start</button>
    </div>
  ),
}));

// ─── Mock fetchGameRoom so tests control backend responses ───────────────────

vi.mock("@/lib/api/games", () => ({
  fetchGameRoom: vi.fn(),
}));

import { fetchGameRoom } from "@/lib/api/games";
import type { RoomLookupResult } from "@/lib/api/games";

const mockFetchGameRoom = vi.mocked(fetchGameRoom);

async function renderPage(
  searchParams?: Promise<Record<string, string | string[] | undefined>>,
) {
  return render(await GameWaitingPage({ searchParams }));
}

describe("GameWaitingPage — backend validation (#1479)", () => {
  beforeEach(() => {
    mockFetchGameRoom.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 404: unknown code → Room Not Found UI ─────────────────────────────────

  describe("Unknown code — backend returns 404", () => {
    beforeEach(() => {
      mockFetchGameRoom.mockResolvedValue({
        found: false,
        reason: "not_found",
      } satisfies RoomLookupResult);
    });

    test("renders 'Room Not Found' heading for unknown code", async () => {
      await renderPage(Promise.resolve({ gameCode: "ZZZZZ9" }));
      expect(
        screen.getByRole("heading", { name: "Room Not Found" }),
      ).toBeInTheDocument();
    });

    test("renders alert landmark for unknown code", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ZZZZZ9" }),
      );
      expect(
        container.querySelector('main[role="alert"]'),
      ).toBeInTheDocument();
    });

    test("does NOT render the waiting client for unknown code", async () => {
      await renderPage(Promise.resolve({ gameCode: "ZZZZZ9" }));
      expect(
        screen.queryByTestId("game-waiting-client"),
      ).not.toBeInTheDocument();
    });

    test("shows the game code in the not-found message", async () => {
      await renderPage(Promise.resolve({ gameCode: "ZZZZZ9" }));
      expect(screen.getByText(/ZZZZZ9/)).toBeInTheDocument();
    });

    test("provides a link back to game-settings", async () => {
      await renderPage(Promise.resolve({ gameCode: "ZZZZZ9" }));
      expect(
        screen.getByRole("link", { name: "Back to Game Settings" }),
      ).toHaveAttribute("href", "/game-settings");
    });

    test("status announcer describes the not-found state", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ZZZZZ9" }),
      );
      const status = container.querySelector('[role="status"]');
      expect(status?.textContent).toContain("not found");
    });

    test("does NOT render any countdown / timer element", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ZZZZZ9" }),
      );
      // Countdown would have aria-live="off" or a specific test-id
      expect(container.querySelector('[data-testid="countdown"]')).toBeNull();
      expect(container.querySelector('[aria-label*="countdown"]')).toBeNull();
    });
  });

  // ─── 200: valid code → waiting lobby ──────────────────────────────────────

  describe("Valid code — backend returns 200", () => {
    beforeEach(() => {
      mockFetchGameRoom.mockResolvedValue({
        found: true,
        game: {
          id: 1,
          code: "ABC123",
          status: "PENDING",
          mode: "PUBLIC",
          numberOfPlayers: 4,
        },
      } satisfies RoomLookupResult);
    });

    test("renders the waiting lobby for a valid code", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      expect(
        screen.getByRole("heading", { level: 1, name: "Waiting for Players" }),
      ).toBeInTheDocument();
    });

    test("renders the GameWaitingClient for a valid code", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      expect(screen.getByTestId("game-waiting-client")).toBeInTheDocument();
    });

    test("main landmark has aria-busy=true while waiting", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ABC123" }),
      );
      expect(
        container.querySelector('main[aria-busy="true"]'),
      ).toBeInTheDocument();
    });

    test("skip link targets the waiting content section", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      expect(
        screen.getByRole("link", { name: "Skip to waiting lobby" }),
      ).toHaveAttribute("href", "#game-waiting-content");
    });

    test("status announcer contains the game code", async () => {
      const { container } = await renderPage(
        Promise.resolve({ gameCode: "ABC123" }),
      );
      const announcer = container.querySelector("#game-waiting-status");
      expect(announcer?.textContent).toContain("ABC123");
    });
  });

  // ─── Network error → graceful degradation ─────────────────────────────────

  describe("Network error — graceful degradation", () => {
    beforeEach(() => {
      mockFetchGameRoom.mockResolvedValue({
        found: false,
        reason: "network_error",
      } satisfies RoomLookupResult);
    });

    test("shows waiting lobby despite network error (graceful degradation)", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      expect(screen.getByTestId("game-waiting-client")).toBeInTheDocument();
    });

    test("does NOT show 'Room Not Found' for a network error", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      expect(
        screen.queryByRole("heading", { name: "Room Not Found" }),
      ).not.toBeInTheDocument();
    });
  });

  // ─── Rate-limited → graceful degradation ──────────────────────────────────

  describe("Rate-limited (429) — graceful degradation", () => {
    beforeEach(() => {
      mockFetchGameRoom.mockResolvedValue({
        found: false,
        reason: "rate_limited",
      } satisfies RoomLookupResult);
    });

    test("shows waiting lobby when rate-limited (graceful degradation)", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      expect(screen.getByTestId("game-waiting-client")).toBeInTheDocument();
    });
  });

  // ─── Invalid format — no backend call ─────────────────────────────────────

  describe("Invalid format — no backend call made", () => {
    test("shows Invalid Game Code for malformed code without calling fetchGameRoom", async () => {
      await renderPage(Promise.resolve({ gameCode: "!@#$" }));
      expect(
        screen.getByRole("heading", { name: "Invalid Game Code" }),
      ).toBeInTheDocument();
      expect(mockFetchGameRoom).not.toHaveBeenCalled();
    });

    test("shows Invalid Game Code for missing code without calling fetchGameRoom", async () => {
      await renderPage(Promise.resolve({}));
      expect(
        screen.getByRole("heading", { name: "Invalid Game Code" }),
      ).toBeInTheDocument();
      expect(mockFetchGameRoom).not.toHaveBeenCalled();
    });

    test("shows Invalid Game Code for too-short code without calling fetchGameRoom", async () => {
      await renderPage(Promise.resolve({ gameCode: "AB" }));
      expect(
        screen.getByRole("heading", { name: "Invalid Game Code" }),
      ).toBeInTheDocument();
      expect(mockFetchGameRoom).not.toHaveBeenCalled();
    });
  });

  // ─── fetchGameRoom is called with the normalised code ─────────────────────

  describe("Backend call contract", () => {
    beforeEach(() => {
      mockFetchGameRoom.mockResolvedValue({
        found: true,
        game: {
          id: 1,
          code: "ABC123",
          status: "PENDING",
          mode: "PUBLIC",
          numberOfPlayers: 4,
        },
      } satisfies RoomLookupResult);
    });

    test("calls fetchGameRoom with the uppercased game code", async () => {
      await renderPage(Promise.resolve({ gameCode: "abc123" }));
      expect(mockFetchGameRoom).toHaveBeenCalledWith("ABC123");
    });

    test("calls fetchGameRoom once per page render", async () => {
      await renderPage(Promise.resolve({ gameCode: "ABC123" }));
      expect(mockFetchGameRoom).toHaveBeenCalledTimes(1);
    });
  });
});
