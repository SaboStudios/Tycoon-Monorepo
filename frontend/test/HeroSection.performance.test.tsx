import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ─── Shared mocks ────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const animationProps: Array<{ preRenderFirstString?: boolean; sequence?: Array<string | number> }> = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
import {
  HERO_LCP_BUDGET_MS,
  HERO_CLS_BUDGET,
  observeHeroPerfBudget,
} from "@/lib/hero-perf-budget";

// ─── Budget constants ─────────────────────────────────────────────────────────

describe("Hero performance budget constants", () => {
  it("LCP budget is at most 2500 ms (Web Vitals 'Good' threshold)", () => {
    expect(HERO_LCP_BUDGET_MS).toBeLessThanOrEqual(2500);
    expect(HERO_LCP_BUDGET_MS).toBeGreaterThan(0);
  });

  it("CLS budget is at most 0.1 (Web Vitals 'Good' threshold)", () => {
    expect(HERO_CLS_BUDGET).toBeLessThanOrEqual(0.1);
    expect(HERO_CLS_BUDGET).toBeGreaterThan(0);
  });
});

// ─── observeHeroPerfBudget ────────────────────────────────────────────────────

describe("observeHeroPerfBudget", () => {
  it("returns a cleanup function", () => {
    const cleanup = observeHeroPerfBudget();
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("calls onViolation when LCP exceeds budget", () => {
    const onViolation = vi.fn();
    let lcpCallback: ((list: { getEntries: () => object[] }) => void) | null = null;

    const original = globalThis.PerformanceObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.PerformanceObserver = function (cb: any) {
      return {
        observe({ type }: { type: string }) {
          if (type === "largest-contentful-paint") lcpCallback = cb;
        },
        disconnect() {},
      };
    } as unknown as typeof PerformanceObserver;

    observeHeroPerfBudget(onViolation);

    // Simulate an LCP entry that exceeds the budget
    lcpCallback?.({
      getEntries: () => [{ startTime: HERO_LCP_BUDGET_MS + 100 }],
    });

    expect(onViolation).toHaveBeenCalledWith({
      metric: "LCP",
      value: HERO_LCP_BUDGET_MS + 100,
      budget: HERO_LCP_BUDGET_MS,
    });

    globalThis.PerformanceObserver = original;
  });

  it("does NOT call onViolation when LCP is within budget", () => {
    const onViolation = vi.fn();
    let lcpCallback: ((list: { getEntries: () => object[] }) => void) | null = null;

    const original = globalThis.PerformanceObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.PerformanceObserver = function (cb: any) {
      return {
        observe({ type }: { type: string }) {
          if (type === "largest-contentful-paint") lcpCallback = cb;
        },
        disconnect() {},
      };
    } as unknown as typeof PerformanceObserver;

    observeHeroPerfBudget(onViolation);

    lcpCallback?.({
      getEntries: () => [{ startTime: HERO_LCP_BUDGET_MS - 100 }],
    });

    expect(onViolation).not.toHaveBeenCalled();

    globalThis.PerformanceObserver = original;
  });

  it("calls onViolation when cumulative CLS exceeds budget", () => {
    const onViolation = vi.fn();
    let clsCallback: ((list: { getEntries: () => object[] }) => void) | null = null;

    const original = globalThis.PerformanceObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.PerformanceObserver = function (cb: any) {
      return {
        observe({ type }: { type: string }) {
          if (type === "layout-shift") clsCallback = cb;
        },
        disconnect() {},
      };
    } as unknown as typeof PerformanceObserver;

    observeHeroPerfBudget(onViolation);

    // Simulate a layout-shift entry that pushes CLS over budget
    clsCallback?.({
      getEntries: () => [{ hadRecentInput: false, value: HERO_CLS_BUDGET + 0.05 }],
    });

    expect(onViolation).toHaveBeenCalledWith(
      expect.objectContaining({ metric: "CLS" }),
    );

    globalThis.PerformanceObserver = original;
  });

  it("ignores layout shifts caused by recent user input", () => {
    const onViolation = vi.fn();
    let clsCallback: ((list: { getEntries: () => object[] }) => void) | null = null;

    const original = globalThis.PerformanceObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.PerformanceObserver = function (cb: any) {
      return {
        observe({ type }: { type: string }) {
          if (type === "layout-shift") clsCallback = cb;
        },
        disconnect() {},
      };
    } as unknown as typeof PerformanceObserver;

    observeHeroPerfBudget(onViolation);

    // hadRecentInput: true — should be ignored
    clsCallback?.({
      getEntries: () => [{ hadRecentInput: true, value: 0.5 }],
    });

    expect(onViolation).not.toHaveBeenCalled();

    globalThis.PerformanceObserver = original;
  });

  it("returns a no-op cleanup when PerformanceObserver is unavailable", () => {
    const original = globalThis.PerformanceObserver;
    // @ts-expect-error intentionally removing for test
    delete globalThis.PerformanceObserver;

    const cleanup = observeHeroPerfBudget();
    expect(() => cleanup()).not.toThrow();

    globalThis.PerformanceObserver = original;
  });
});

// ─── HeroSection structural guardrails ───────────────────────────────────────

describe("HeroSection performance guardrails", () => {
  beforeEach(() => {
    animationProps.length = 0;
    mockPush.mockClear();
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

  it("marks the h1 as the LCP candidate with data-lcp attribute", () => {
    render(<HeroSection />);
    const h1 = screen.getByTestId("hero-main-title");
    expect(h1.getAttribute("data-lcp")).toBe("true");
  });

  it("animated text containers have explicit min-height to prevent CLS", () => {
    const { container } = render(<HeroSection />);
    // Both TypeAnimation wrappers sit inside divs with min-h-* classes
    const ariaLiveDivs = container.querySelectorAll("[aria-live='polite']");
    expect(ariaLiveDivs.length).toBeGreaterThanOrEqual(2);
    for (const div of ariaLiveDivs) {
      expect(div.className).toMatch(/min-h-/);
    }
  });
});

// ─── HeroSection accessibility (kept from original) ──────────────────────────

describe("HeroSection accessibility", () => {
  beforeEach(() => {
    animationProps.length = 0;
    mockPush.mockClear();
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
    const decorativeBg = container.querySelector<HTMLElement>(
      "section > div[aria-hidden='true']",
    );
    expect(decorativeBg).not.toBeNull();
  });
});
