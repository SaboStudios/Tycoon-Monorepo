import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockPush = vi.fn();
const mockTrack = vi.fn();
const animationProps: Array<{ preRenderFirstString?: boolean; sequence?: Array<string | number> }> = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
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

describe("HeroSection performance guardrails", () => {
  beforeEach(() => {
    animationProps.length = 0;
    mockPush.mockClear();
    mockTrack.mockClear();
  });

  it("reserves stable hero structure and pre-renders animated copy", () => {
    render(<HeroSection />);

    expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();
    expect(screen.getByTestId("hero-primary-cta")).toBeInTheDocument();

    expect(animationProps).toHaveLength(2);
    for (const props of animationProps) {
      expect(props.preRenderFirstString).toBe(true);
      expect(props.sequence).not.toContain("");
    }
  });
});

describe("HeroSection accessibility", () => {
  beforeEach(() => {
    animationProps.length = 0;
    mockPush.mockClear();
    mockTrack.mockClear();
  });

  it("has a single h1 in the hero section", () => {
    render(<HeroSection />);
    const headings = document.querySelectorAll("h1");
    expect(headings).toHaveLength(1);
  });

  it("section has aria-label", () => {
    render(<HeroSection />);
    expect(screen.getByRole("region", { name: "Hero" })).toBeInTheDocument();
  });

  it("all CTA buttons have accessible names", () => {
    render(<HeroSection />);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).toHaveAttribute("aria-label");
    }
  });

  it("decorative background elements are hidden from assistive technology", () => {
    const { container } = render(<HeroSection />);
    // The decorative wrapper div (background gradient) must be aria-hidden
    const decorativeBg = container.querySelector<HTMLElement>(
      "section > div[aria-hidden='true']",
    );
    expect(decorativeBg).not.toBeNull();
  });
});

