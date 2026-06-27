import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import OfflineStatus from "../OfflineStatus";

const SESSION_STORAGE_KEY = "tycoon.offline.last-known-status";

describe("OfflineStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders offline state and a retry action when disconnected", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    render(<OfflineStatus />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /connection status/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/live game state is unavailable until connectivity returns/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry connection/i })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });

  it("updates the call to action when the browser comes back online", async () => {
    const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    render(<OfflineStatus />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry connection/i })).toBeInTheDocument();
    });

    onlineSpy.mockReturnValue(true);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /refresh page/i })).toBeInTheDocument();
    });
  });
});
