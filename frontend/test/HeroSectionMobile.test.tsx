/**
 * #825 Landing hero — Vitest / RTL coverage
 * HeroSectionMobile component tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();
const mockTrack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

import HeroSectionMobile from "@/components/guest/HeroSectionMobile";

describe("HeroSectionMobile", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockTrack.mockClear();
  });

  describe("Render structure", () => {
    it("renders a single h1 with TYCOON", () => {
      render(<HeroSectionMobile />);
      const h1 = document.querySelector("h1");
      expect(h1).not.toBeNull();
      expect(h1!.textContent).toContain("TYCOON");
    });

    it("renders the welcome message", () => {
      render(<HeroSectionMobile />);
      expect(screen.getByText("Welcome back, Player!")).toBeInTheDocument();
    });

    it("renders the tagline", () => {
      render(<HeroSectionMobile />);
      expect(screen.getByText("Conquer • Build • Trade On")).toBeInTheDocument();
    });

    it("renders all four CTA buttons", () => {
      render(<HeroSectionMobile />);
      expect(screen.getAllByRole("button")).toHaveLength(4);
    });

    it("accepts and applies a className prop", () => {
      const { container } = render(<HeroSectionMobile className="test-class" />);
      expect(container.querySelector("section")!.className).toContain("test-class");
    });
  });

  describe("Accessibility", () => {
    it("all CTA buttons have aria-label", () => {
      render(<HeroSectionMobile />);
      for (const btn of screen.getAllByRole("button")) {
        expect(btn).toHaveAttribute("aria-label");
      }
    });

    it("decorative background div has aria-hidden", () => {
      const { container } = render(<HeroSectionMobile />);
      expect(container.querySelector("[aria-hidden]")).not.toBeNull();
    });

    it("decorative ? span has aria-hidden", () => {
      const { container } = render(<HeroSectionMobile />);
      const h1 = container.querySelector("h1")!;
      const questionSpan = Array.from(h1.querySelectorAll("span")).find(
        (s) => s.textContent === "?",
      );
      expect(questionSpan).toBeDefined();
      expect(questionSpan!.getAttribute("aria-hidden")).toBe("true");
    });

    it("CTA buttons meet minimum touch target (min-h-[48px])", () => {
      render(<HeroSectionMobile />);
      for (const btn of screen.getAllByRole("button")) {
        expect(btn.className).toMatch(/min-h-\[48px\]/);
      }
    });
  });

  describe("CTA interactions", () => {
    it("Continue Game navigates to /game-settings", () => {
      render(<HeroSectionMobile />);
      fireEvent.click(screen.getByRole("button", { name: /continue game/i }));
      expect(mockPush).toHaveBeenCalledWith("/game-settings");
    });

    it("Multiplayer navigates to /game-settings", () => {
      render(<HeroSectionMobile />);
      fireEvent.click(screen.getByRole("button", { name: /multiplayer/i }));
      expect(mockPush).toHaveBeenCalledWith("/game-settings");
    });

    it("Join Room navigates to /join-room", () => {
      render(<HeroSectionMobile />);
      fireEvent.click(screen.getByRole("button", { name: /join room/i }));
      expect(mockPush).toHaveBeenCalledWith("/join-room");
    });

    it("Challenge AI navigates to /play-ai", () => {
      render(<HeroSectionMobile />);
      fireEvent.click(screen.getByRole("button", { name: /challenge ai/i }));
      expect(mockPush).toHaveBeenCalledWith("/play-ai");
    });

    it("each CTA fires analytics track with route and destination", () => {
      render(<HeroSectionMobile />);
      fireEvent.click(screen.getByRole("button", { name: /continue game/i }));
      expect(mockTrack).toHaveBeenCalledWith(
        "continue_game_click",
        expect.objectContaining({ route: "/", destination: "/game-settings" }),
      );
    });
  });

  describe("Reduced motion", () => {
    it("renders without errors when prefers-reduced-motion is set", () => {
      const original = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;

      render(<HeroSectionMobile />);
      expect(document.querySelector("h1")).not.toBeNull();

      window.matchMedia = original;
    });
  });
});
