/**
 * #833 Landing hero — keyboard shortcut bindings
 * Tests that G/M/J/A keys trigger navigation from the hero section.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import HeroSection from "../HeroSection";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/useHeroTelemetry", () => ({
  useHeroTelemetry: () => ({ fire: vi.fn() }),
}));

vi.mock("@/lib/errors", () => ({
  sanitizeError: vi.fn(),
}));

// Stub lazy TypeAnimation to avoid Suspense complexity in tests
vi.mock("react-type-animation", () => ({
  TypeAnimation: ({ sequence }: { sequence: (string | number)[] }) => (
    <span>{sequence[0] as string}</span>
  ),
}));

describe("HeroSection keyboard shortcuts (#833)", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("pressing G navigates to /game-settings", async () => {
    render(<HeroSection />);
    await userEvent.keyboard("g");
    expect(mockPush).toHaveBeenCalledWith("/game-settings");
  });

  it("pressing M navigates to /game-settings (multiplayer)", async () => {
    render(<HeroSection />);
    await userEvent.keyboard("m");
    expect(mockPush).toHaveBeenCalledWith("/game-settings");
  });

  it("pressing J navigates to /join-room", async () => {
    render(<HeroSection />);
    await userEvent.keyboard("j");
    expect(mockPush).toHaveBeenCalledWith("/join-room");
  });

  it("pressing A navigates to /play-ai", async () => {
    render(<HeroSection />);
    await userEvent.keyboard("a");
    expect(mockPush).toHaveBeenCalledWith("/play-ai");
  });

  it("does not trigger shortcut when focus is inside a button", async () => {
    render(<HeroSection />);
    const btn = screen.getByRole("button", { name: /continue game/i });
    btn.focus();
    await userEvent.keyboard("j");
    // Should not navigate because focus is on a button
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not trigger shortcut with modifier keys held", async () => {
    render(<HeroSection />);
    await userEvent.keyboard("{Control>}j{/Control}");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("hero buttons have aria-keyshortcuts attributes", () => {
    render(<HeroSection />);
    expect(screen.getByRole("button", { name: /continue game/i })).toHaveAttribute("aria-keyshortcuts", "G");
    expect(screen.getByRole("button", { name: /multiplayer/i })).toHaveAttribute("aria-keyshortcuts", "M");
    expect(screen.getByRole("button", { name: /join room/i })).toHaveAttribute("aria-keyshortcuts", "J");
    expect(screen.getByRole("button", { name: /challenge ai/i })).toHaveAttribute("aria-keyshortcuts", "A");
  });
});
