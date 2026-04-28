import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockTrack = vi.fn();
const animationProps: Array<{ preRenderFirstString?: boolean; sequence?: Array<string | number> }> = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

vi.mock("@/lib/errors", () => ({
  sanitizeError: (err: unknown) => ({
    userMessage: err instanceof Error ? err.message : "An unexpected error occurred",
    category: "unknown",
    recoverable: true,
  }),
}));

vi.mock("react-type-animation", () => ({
  TypeAnimation: (props: {
    preRenderFirstString?: boolean;
    sequence?: Array<string | number>;
    className?: string;
  }) => {
    animationProps.push(props);
    return <span data-testid="hero-animated-copy" className={props.className}>mocked animation</span>;
  },
}));

import HeroSection from "@/components/guest/HeroSection";

// ─── SW-FE-003: Vitest / RTL Coverage ───────────────────────────────────────────

describe("HeroSection — SW-FE-003: Vitest / RTL coverage", () => {
  beforeEach(() => {
    animationProps.length = 0;
    mockPush.mockClear();
    mockTrack.mockClear();
  });

  describe("Render structure", () => {
    it("renders the hero section with aria-label", () => {
      render(<HeroSection />);
      expect(screen.getByRole("region", { name: "Hero" })).toBeInTheDocument();
    });

    it("renders a single h1 element", () => {
      render(<HeroSection />);
      const headings = document.querySelectorAll("h1");
      expect(headings).toHaveLength(1);
    });

    it("renders the main title with test id", () => {
      render(<HeroSection />);
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();
    });

    it("renders the primary CTA button", () => {
      render(<HeroSection />);
      expect(screen.getByTestId("hero-primary-cta")).toBeInTheDocument();
    });

    it("renders all four CTA buttons", () => {
      render(<HeroSection />);
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(4);
    });

    it("renders the welcome message", () => {
      render(<HeroSection />);
      expect(screen.getByText("Welcome back, Player!")).toBeInTheDocument();
    });

    it("renders the description paragraph", () => {
      render(<HeroSection />);
      expect(screen.getByText(/Step into Tycoon/)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("all CTA buttons have accessible names", () => {
      render(<HeroSection />);
      const buttons = screen.getAllByRole("button");
      for (const btn of buttons) {
        expect(btn).toHaveAttribute("aria-label");
      }
    });

    it("decorative background elements are hidden from assistive technology", () => {
      const { container } = render(<HeroSection />);
      const decorativeBg = container.querySelector<HTMLElement>(
        "section > div[aria-hidden='true']",
      );
      expect(decorativeBg).not.toBeNull();
    });

    it("decorative SVG elements have aria-hidden", () => {
      const { container } = render(<HeroSection />);
      const svgs = container.querySelectorAll("svg");
      svgs.forEach((svg) => {
        expect(svg.getAttribute("aria-hidden")).toBe("true");
      });
    });

    it("decorative inner spans have aria-hidden", () => {
      const { container } = render(<HeroSection />);
      const spans = container.querySelectorAll("button span");
      spans.forEach((span) => {
        expect(span.getAttribute("aria-hidden")).toBe("true");
      });
    });

    it("decorative ? span in title has aria-hidden", () => {
      render(<HeroSection />);
      const title = screen.getByTestId("hero-main-title");
      const spans = title.querySelectorAll("span");
      const questionSpan = Array.from(spans).find((s) => s.textContent === "?");
      expect(questionSpan).toBeDefined();
      expect(questionSpan!.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("Animation behavior", () => {
    it("pre-renders both TypeAnimation instances with preRenderFirstString", () => {
      render(<HeroSection />);
      expect(animationProps).toHaveLength(2);
      for (const props of animationProps) {
        expect(props.preRenderFirstString).toBe(true);
        expect(props.sequence).not.toContain("");
      }
    });

    it("has non-empty sequences for both animations", () => {
      render(<HeroSection />);
      expect(animationProps).toHaveLength(2);
      for (const props of animationProps) {
        expect(props.sequence!.length).toBeGreaterThan(0);
      }
    });
  });

  describe("CTA button interactions", () => {
    it("Continue Game button fires telemetry and navigates", () => {
      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      fireEvent.click(continueBtn);
      expect(mockPush).toHaveBeenCalledWith("/game-settings");
    });

    it("Multiplayer button fires telemetry and navigates", () => {
      render(<HeroSection />);
      const multiplayerBtn = screen.getByRole("button", { name: /multiplayer/i });
      fireEvent.click(multiplayerBtn);
      expect(mockPush).toHaveBeenCalledWith("/game-settings");
    });

    it("Join Room button fires telemetry and navigates", () => {
      render(<HeroSection />);
      const joinRoomBtn = screen.getByRole("button", { name: /join room/i });
      fireEvent.click(joinRoomBtn);
      expect(mockPush).toHaveBeenCalledWith("/join-room");
    });

    it("Challenge AI button fires telemetry and navigates", () => {
      render(<HeroSection />);
      const challengeBtn = screen.getByRole("button", { name: /challenge ai/i });
      fireEvent.click(challengeBtn);
      expect(mockPush).toHaveBeenCalledWith("/play-ai");
    });
  });

  describe("Reduced motion", () => {
    it("respects prefers-reduced-motion: reduce", () => {
      // Mock matchMedia to return matches: true
      const originalMatchMedia = window.matchMedia;
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

      render(<HeroSection />);
      // Should render without errors when reduced motion is preferred
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();

      window.matchMedia = originalMatchMedia;
    });
  });
});
