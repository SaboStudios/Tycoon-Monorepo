/**
 * Test Suite: JoinRoomForm Connection Resilience & TypeScript Strictness
 * Feature: SW-FE-TYC-001 (Join room with improved error handling for disconnected states)
 *
 * Tests cover:
 * - Network error detection and recovery
 * - Request timeout handling with AbortController
 * - Connection error state tracking
 * - Proper cleanup of async operations
 * - TypeScript strictness with null guards
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "./mocks/join-room-i18n";
import JoinRoomForm from "@/components/settings/JoinRoomForm";

// ─── Mock next/navigation ─────────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Mock apiClient with AbortController support ────────────────────────────
const mockPost = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args) },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function seedAuthToken(): void {
  localStorage.setItem("access_token", "test-token");
}

function clearAuthToken(): void {
  localStorage.removeItem("access_token");
}

function renderForm(): ReturnType<typeof render> {
  return render(<JoinRoomForm />);
}

function getInput(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

function getButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /join/i }) as HTMLButtonElement;
}

function getErrorBanner(): HTMLElement | null {
  return screen.queryByTestId("form-error-banner");
}

// ─── Setup & Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockPush.mockClear();
  mockPost.mockClear();
  mockPost.mockResolvedValue({ id: 1, code: "TYC001" });
  seedAuthToken();
  vi.clearAllTimers();
});

afterEach(() => {
  clearAuthToken();
  vi.clearAllMocks();
});

// ─── Test Suite: Network Error Handling ───────────────────────────────────────

describe("JoinRoomForm — Network Error Handling (SW-FE-TYC-001)", () => {
  it("detects network error and displays appropriate message", async () => {
    const networkError = new Error("Failed to fetch");
    mockPost.mockRejectedValueOnce(networkError);

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(getErrorBanner()).toBeInTheDocument();
      expect(getErrorBanner()).toHaveTextContent(/network/i);
    });
  });

  it("sets connectionError state on network failure", async () => {
    mockPost.mockRejectedValueOnce(new Error("Network request failed"));

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(screen.queryByTestId("form-error-banner")).toBeInTheDocument();
    });
  });

  it("allows retry after network error when code is still valid", async () => {
    mockPost.mockRejectedValueOnce(new Error("Network request failed"));
    mockPost.mockResolvedValueOnce({ id: 1, code: "TYC001" });

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(getErrorBanner()).toBeInTheDocument();
    });

    // User clicks retry button
    const retryButton = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPush).toHaveBeenCalledWith("/game-waiting?gameCode=TYC001");
    });
  });
});

// ─── Test Suite: Timeout Handling ─────────────────────────────────────────────

describe("JoinRoomForm — Timeout Handling (SW-FE-TYC-001)", () => {
  it("handles request timeout gracefully", async () => {
    const timeoutError = new Error("Request timeout");
    mockPost.mockRejectedValueOnce(timeoutError);

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(getErrorBanner()).toBeInTheDocument();
    });

    expect(getButton()).not.toBeDisabled();
  });

  it("displays timeout message and allows retry", async () => {
    mockPost.mockRejectedValueOnce(new Error("Request timeout"));
    mockPost.mockResolvedValueOnce({ id: 1, code: "TYC001" });

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(getErrorBanner()).toHaveTextContent(/timeout|time out/i);
    });

    const retryButton = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/game-waiting?gameCode=TYC001");
    });
  });
});

// ─── Test Suite: Abort Controller & Cleanup ───────────────────────────────────

describe("JoinRoomForm — Async Cleanup (SW-FE-TYC-001)", () => {
  it("aborts pending request on component unmount", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    
    // Mock a never-resolving request
    mockPost.mockImplementation(
      () => new Promise(() => {
        // Never resolves
      })
    );

    const { unmount } = renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    // Component is unmounted before request completes
    unmount();

    // AbortController.abort() should have been called during cleanup
    expect(abortSpy).toHaveBeenCalled();
    abortSpy.mockRestore();
  });

  it("clears error state when user presses Escape", async () => {
    mockPost.mockRejectedValueOnce(new Error("Network error"));

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(getErrorBanner()).toBeInTheDocument();
    });

    // User presses Escape to clear errors
    fireEvent.keyDown(document, { key: "Escape" });
    getInput().focus();
    fireEvent.keyDown(getInput(), { key: "Escape" });

    // Error banner should be cleared
    expect(getErrorBanner()).not.toBeInTheDocument();
  });

  it("maintains form state after error recovery", async () => {
    mockPost.mockRejectedValueOnce(new Error("Network error"));

    renderForm();
    const originalCode = "TYC001";
    fireEvent.change(getInput(), { target: { value: originalCode } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(getErrorBanner()).toBeInTheDocument();
    });

    // Code should still be there
    expect(getInput().value).toBe(originalCode);
    expect(getButton()).not.toBeDisabled();
  });
});

// ─── Test Suite: Connection Error State Tracking ──────────────────────────────

describe("JoinRoomForm — Connection Error State (SW-FE-TYC-001)", () => {
  it("distinguishes between network and authorization errors", async () => {
    clearAuthToken();

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(getErrorBanner()).toHaveTextContent(/sign in|unauthorized|not authorized/i);
    });

    // Should not call API when unauthorized
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("displays loading state during request", async () => {
    mockPost.mockImplementation(
      () => new Promise(() => {
        // Never resolves in this test
      })
    );

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    // Button should show loading state
    expect(screen.getByRole("button", { name: /joining/i })).toBeInTheDocument();
    expect(getButton()).toBeDisabled();
  });

  it("clears loading state after request completes", async () => {
    mockPost.mockResolvedValueOnce({ id: 1, code: "TYC001" });

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });

    // Button should be re-enabled if navigation hasn't occurred
    // (in real scenario, navigation would unmount the component)
  });

  it("enforces rate limiting even with connection errors", async () => {
    mockPost.mockRejectedValue(new Error("Network error"));

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });

    // First attempt
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(getErrorBanner()).toBeInTheDocument();
    });

    // Second attempt immediately after (within cooldown)
    fireEvent.click(getButton());

    // Should show rate limit error, not network error
    expect(getErrorBanner()).toHaveTextContent(/too many|rate limit|wait/i);
  });
});

// ─── Test Suite: TypeScript Type Safety ───────────────────────────────────────

describe("JoinRoomForm — TypeScript Strictness (SW-FE-TYC-001)", () => {
  it("renders with optional previewState prop", () => {
    const { rerender } = render(<JoinRoomForm />);
    expect(getInput()).toBeInTheDocument();

    rerender(
      <JoinRoomForm
        previewState={{
          code: "TYC001",
          isLoading: false,
        }}
      />
    );

    expect(getInput().value).toBe("TYC001");
  });

  it("respects skipAutoFocus when provided in previewState", () => {
    const { unmount } = render(
      <JoinRoomForm previewState={{ skipAutoFocus: true }} />
    );

    // Input should not be focused
    expect(document.activeElement).not.toBe(getInput());

    unmount();

    // Without skipAutoFocus, input should be focused
    render(<JoinRoomForm />);
    expect(document.activeElement).toBe(getInput());
  });

  it("initializes with default state when previewState is undefined", () => {
    render(<JoinRoomForm previewState={undefined} />);
    expect(getInput().value).toBe("");
    expect(getErrorBanner()).not.toBeInTheDocument();
  });
});

// ─── Test Suite: Keyboard Shortcuts & Accessibility ─────────────────────────

describe("JoinRoomForm — Keyboard Navigation (SW-FE-TYC-001)", () => {
  it("clears form and error state on Escape key", async () => {
    mockPost.mockRejectedValueOnce(new Error("Network error"));

    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });
    fireEvent.click(getButton());

    await waitFor(() => {
      expect(getErrorBanner()).toBeInTheDocument();
    });

    // Press Escape while input is focused
    getInput().focus();
    fireEvent.keyDown(document, { key: "Escape" });

    // State should be cleared
    expect(getInput().value).toBe("");
    expect(getErrorBanner()).not.toBeInTheDocument();
  });

  it("submits form on Ctrl+Enter", async () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });

    // Press Ctrl+Enter
    fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/games/TYC001/join", {});
    });
  });

  it("submits form on Cmd+Enter (Mac)", async () => {
    renderForm();
    fireEvent.change(getInput(), { target: { value: "TYC001" } });

    // Press Cmd+Enter
    fireEvent.keyDown(document, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/games/TYC001/join", {});
    });
  });
});
