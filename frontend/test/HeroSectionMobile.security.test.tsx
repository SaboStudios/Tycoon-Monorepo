import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const mockPush = vi.fn();
const mockFire = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/useHeroTelemetry", () => ({
  useHeroTelemetry: () => ({ fire: mockFire }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/errors", () => ({
  sanitizeError: (err: unknown) => ({
    userMessage: err instanceof Error ? err.message : "An unexpected error occurred",
    category: "unknown",
    recoverable: true,
  }),
}));

import HeroSectionMobile from "@/components/guest/HeroSectionMobile";

describe("HeroSectionMobile security hardening — error fallback", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockFire.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a safe error state when router.push throws", () => {
    mockPush.mockImplementationOnce(() => {
      throw new Error("Navigation failed");
    });

    render(<HeroSectionMobile />);

    const continueBtn = screen.getByRole("button", { name: /continue_game/i });
    fireEvent.click(continueBtn);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("hero.error.heading")).toBeInTheDocument();
    expect(screen.getByText("Navigation failed")).toBeInTheDocument();
  });

  it("allows retry after a navigation failure", () => {
    mockPush.mockImplementationOnce(() => {
      throw new Error("Navigation failed");
    });

    render(<HeroSectionMobile />);

    const continueBtn = screen.getByRole("button", { name: /continue_game/i });
    fireEvent.click(continueBtn);

    const retryButton = screen.getByRole("button", { name: /hero.error.try_again/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("hero.welcome")).toBeInTheDocument();
  });
});
