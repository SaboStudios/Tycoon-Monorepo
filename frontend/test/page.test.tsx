import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

type DynamicOptions = { ssr?: boolean; loading?: () => unknown } | undefined;
const mockState = vi.hoisted(() => ({
  dynamicCalls: [] as DynamicOptions[],
}));

vi.mock("next/dynamic", () => ({
  default: (
    _loader: unknown,
    options?: { ssr?: boolean; loading?: () => unknown },
  ) => {
    mockState.dynamicCalls.push(options);
    return function DynamicSection() {
      return <div data-testid="home-lazy-section" />;
    };
  },
}));

vi.mock("@/components/guest/HeroSection", () => ({
  default: () => <section data-testid="hero-desktop" />,
}));

vi.mock("@/components/guest/HeroSectionMobile", () => ({
  default: () => <section data-testid="hero-mobile" />,
}));

import HomeClient from "@/clients/HomeClient";

describe("HomeClient", () => {
  it("eagerly renders hero and keeps below-the-fold sections lazy", () => {
    render(<HomeClient />);

    expect(screen.getByTestId("hero-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("hero-mobile")).toBeInTheDocument();

    const lazySections = screen.getAllByTestId("home-lazy-section");
    expect(lazySections).toHaveLength(3);

    expect(mockState.dynamicCalls).toHaveLength(3);
    for (const options of mockState.dynamicCalls) {
      expect(options?.ssr).toBe(false);
      expect(typeof options?.loading).toBe("function");
    }
  });
});
