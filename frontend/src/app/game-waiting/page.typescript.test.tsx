import { render, screen } from "@testing-library/react";
import { expect, test, describe, vi, beforeEach } from "vitest";
import GameWaitingPage from "./page";

vi.mock("@/clients/GameWaitingClient", () => ({
  default: () => <div data-testid="game-waiting-client">Waiting...</div>,
}));

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

describe("GameWaitingPage - TypeScript Strictness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { fetchGameRoom } = vi.mocked(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/lib/api/games") as typeof import("@/lib/api/games"),
    );
    vi.mocked(fetchGameRoom).mockResolvedValue({
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

  describe("Return types", () => {
    test("page resolves to a valid React element", async () => {
      const { container } = render(
        await GameWaitingPage({ searchParams: Promise.resolve({ gameCode: "ABC123" }) }),
      );
      expect(container.firstChild).toBeDefined();
    });

    test("page accepts no searchParams", async () => {
      const { container } = render(await GameWaitingPage({}));
      expect(container.firstChild).toBeDefined();
    });
  });

  describe("Null and undefined guards", () => {
    test("handles missing searchParams gracefully", async () => {
      const { container } = render(await GameWaitingPage({}));
      expect(container.querySelector('main[role="alert"]')).toBeInTheDocument();
    });

    test("handles undefined gameCode", async () => {
      const { container } = render(
        await GameWaitingPage({ searchParams: Promise.resolve({}) }),
      );
      expect(container.querySelector('main[role="alert"]')).toBeInTheDocument();
    });

    test("handles whitespace-only gameCode as invalid", async () => {
      const { container } = render(
        await GameWaitingPage({ searchParams: Promise.resolve({ gameCode: "   " }) }),
      );
      expect(container.querySelector('main[role="alert"]')).toBeInTheDocument();
    });

    test("normalizes valid gameCode to uppercase", async () => {
      const { container } = render(
        await GameWaitingPage({ searchParams: Promise.resolve({ gameCode: "abc123" }) }),
      );
      const announcer = container.querySelector("#game-waiting-status");
      expect(announcer?.textContent).toContain("ABC123");
    });

    test("handles array gameCode — uses first value", async () => {
      const { fetchGameRoom } = vi.mocked(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@/lib/api/games") as typeof import("@/lib/api/games"),
      );
      vi.mocked(fetchGameRoom).mockResolvedValueOnce({
        found: true,
        game: {
          id: 2,
          code: "XYZ789",
          status: "PENDING",
          mode: "PUBLIC",
          numberOfPlayers: 2,
        },
      });

      const { container } = render(
        await GameWaitingPage({
          searchParams: Promise.resolve({ gameCode: ["XYZ789", "OTHER1"] }),
        }),
      );
      const announcer = container.querySelector("#game-waiting-status");
      expect(announcer?.textContent).toContain("XYZ789");
    });

    test("handles empty array gameCode as invalid", async () => {
      const { container } = render(
        await GameWaitingPage({ searchParams: Promise.resolve({ gameCode: [] }) }),
      );
      expect(container.querySelector('main[role="alert"]')).toBeInTheDocument();
    });
  });

  describe("Invalid / stale states", () => {
    test("renders invalid state for malformed gameCode", async () => {
      render(
        await GameWaitingPage({ searchParams: Promise.resolve({ gameCode: "!!" }) }),
      );
      expect(
        screen.getByRole("heading", { name: "Invalid Game Code" }),
      ).toBeInTheDocument();
    });

    test("invalid state does not render waiting client", async () => {
      render(await GameWaitingPage({}));
      expect(screen.queryByTestId("game-waiting-client")).not.toBeInTheDocument();
    });

    test("valid gameCode renders waiting client", async () => {
      render(
        await GameWaitingPage({ searchParams: Promise.resolve({ gameCode: "GAME01" }) }),
      );
      expect(screen.getByTestId("game-waiting-client")).toBeInTheDocument();
    });
  });
});
