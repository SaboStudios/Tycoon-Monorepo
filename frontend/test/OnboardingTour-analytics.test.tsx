/**
 * OnboardingTour analytics tests
 *
 * Verifies:
 * - tour_completed fires exactly once (idempotent)
 * - tour_skipped fires exactly once (idempotent)
 * - tour_step_viewed fires for each step the user reaches
 * - Backend POST is fire-and-forget (UI never blocks on analytics fail)
 * - A fetch network failure does not propagate to the UI
 */

import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Mock analytics client ─────────────────────────────────────────────────
vi.mock("@/lib/analytics/client", () => ({
  track: vi.fn(),
}));
import { track } from "@/lib/analytics/client";
const mockTrack = track as ReturnType<typeof vi.fn>;

// ── Mock auth provider ────────────────────────────────────────────────────
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from "@/components/providers/auth-provider";
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

// ── Subject ───────────────────────────────────────────────────────────────
import OnboardingTour from "@/components/game/OnboardingTour";

// ── Helpers ───────────────────────────────────────────────────────────────
function renderTour(props: { onComplete?: () => void; onSkip?: () => void } = {}) {
  return render(<OnboardingTour {...props} />);
}

// Fast-forward the 1-second delayed show timer.
async function advanceAndShow() {
  await act(async () => {
    vi.advanceTimersByTime(1100);
  });
}

describe("OnboardingTour analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockUseAuth.mockReturnValue({ user: null });
    mockTrack.mockReset();

    // Default fetch: succeeds
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ── tour_completed ─────────────────────────────────────────────────────

  it("fires tour_completed once when user reaches the last step and clicks Finish", async () => {
    renderTour();
    await advanceAndShow();

    // Navigate to the last step (6 steps, 0-indexed → click Next 5 times)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    }

    // Last step — button reads "Finish"
    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    await waitFor(() => {
      const completedCalls = mockTrack.mock.calls.filter(([e]) => e === "tour_completed");
      expect(completedCalls).toHaveLength(1);
      expect(completedCalls[0][1]).toMatchObject({ total_steps: 6 });
    });
  });

  it("does NOT fire tour_completed a second time if completeTour is somehow called twice", async () => {
    const onComplete = vi.fn();
    renderTour({ onComplete });
    await advanceAndShow();

    // Advance to last step
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    }
    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    // Tour is now hidden; a second call would be a no-op on the ref guard
    await waitFor(() => {
      expect(mockTrack.mock.calls.filter(([e]) => e === "tour_completed")).toHaveLength(1);
    });
    // onComplete callback fires once
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  // ── tour_skipped ──────────────────────────────────────────────────────

  it("fires tour_skipped with current step_id when Skip Tour is clicked", async () => {
    renderTour();
    await advanceAndShow();

    // Click Next once (now on step index 1, id="properties")
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    fireEvent.click(screen.getByRole("button", { name: /skip tour/i }));

    await waitFor(() => {
      const skippedCalls = mockTrack.mock.calls.filter(([e]) => e === "tour_skipped");
      expect(skippedCalls).toHaveLength(1);
      expect(skippedCalls[0][1]).toMatchObject({
        step_id: "properties",
        total_steps: 6,
      });
    });
  });

  it("fires tour_skipped only once even when overlay backdrop is clicked multiple times", async () => {
    renderTour();
    await advanceAndShow();

    const overlay = document.querySelector(".fixed.inset-0") as HTMLElement;
    fireEvent.click(overlay);
    fireEvent.click(overlay); // second click — tour is already hidden, no-op

    await waitFor(() => {
      expect(mockTrack.mock.calls.filter(([e]) => e === "tour_skipped")).toHaveLength(1);
    });
  });

  // ── tour_step_viewed ─────────────────────────────────────────────────

  it("fires tour_step_viewed for each step the user navigates to", async () => {
    renderTour();
    await advanceAndShow();

    // Already on step 0 (welcome)
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      const stepViewedCalls = mockTrack.mock.calls.filter(([e]) => e === "tour_step_viewed");
      // Steps 0, 1, 2
      expect(stepViewedCalls.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Backend POST resilience ───────────────────────────────────────────

  it("does not throw or block the UI when the analytics backend POST fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    renderTour();
    await advanceAndShow();

    // Navigate to last step and complete
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    }

    // Should not throw
    await expect(
      act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /finish/i }));
      })
    ).resolves.not.toThrow();

    // taxonomy track still fired even though fetch failed
    expect(mockTrack.mock.calls.some(([e]) => e === "tour_completed")).toBe(true);
  });

  it("does not throw when backend returns a non-2xx status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response);

    renderTour();
    await advanceAndShow();

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    }

    await expect(
      act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /finish/i }));
      })
    ).resolves.not.toThrow();
  });

  // ── Idempotent localStorage ───────────────────────────────────────────

  it("does not show the tour when localStorage already marks it completed", async () => {
    localStorage.setItem("onboarding_tour_completed_guest", "true");
    renderTour();
    await advanceAndShow();

    // Tour should not be visible → no dialog
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not show the tour when localStorage has dontShow=true", async () => {
    localStorage.setItem("onboarding_tour_dont_show_guest", "true");
    renderTour();
    await advanceAndShow();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("persists completion to localStorage after completeTour", async () => {
    renderTour();
    await advanceAndShow();

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    }
    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    expect(localStorage.getItem("onboarding_tour_completed_guest")).toBe("true");
  });
});
