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

