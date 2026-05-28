import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameWaiting from "./GameWaiting";

const pushMock = vi.fn();
const mockSearchParams = { get: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => mockSearchParams,
}));

describe("GameWaiting", () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockSearchParams.get.mockReset();
    sessionStorage.clear();
  });

  const flushLoading = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1600));
    });
  };

  it("shows an invalid room message when the code is missing and no saved code exists", async () => {
    mockSearchParams.get.mockReturnValue(null);
    render(<GameWaiting />);

    await flushLoading();

    await waitFor(() => {
      expect(screen.getByText(/Room code is missing or invalid/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry join/i })).toBeInTheDocument();
  });

  it("renders the validated game code from query params", async () => {
    mockSearchParams.get.mockImplementation((key: string) => (key === "gameCode" ? "abc123" : null));
    render(<GameWaiting />);

    await flushLoading();

    await waitFor(() => {
      expect(screen.getByText(/Code: ABC123/i)).toBeInTheDocument();
    });
  });

  it("falls back to a saved room code when query params are missing", async () => {
    sessionStorage.setItem("tycoon.lastJoinCode", "ABC123");
    mockSearchParams.get.mockReturnValue(null);
    render(<GameWaiting />);

    await flushLoading();

    await waitFor(() => {
      expect(screen.getByText(/Code: ABC123/i)).toBeInTheDocument();
    });
  });
});
