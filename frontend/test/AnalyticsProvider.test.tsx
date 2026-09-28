import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics/client", () => ({
  track: vi.fn(),
  registerAnalyticsDebugHandle: vi.fn(),
  canTrack: vi.fn(() => true),
  isAnalyticsConfigured: vi.fn(() => true),
}));

let mockPathname: string | null = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { track } from "@/lib/analytics/client";
import { AnalyticsProvider } from "@/components/providers/analytics-provider";
import { __resetConsentForTests, setConsent } from "@/lib/analytics/consent";

const mockTrack = track as ReturnType<typeof vi.fn>;

describe("AnalyticsProvider page views (#1761)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetConsentForTests();
    mockPathname = "/";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not track a page view before consent", () => {
    render(<AnalyticsProvider />);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("tracks the current page exactly once when consent is granted later", () => {
    render(<AnalyticsProvider />);
    act(() => setConsent("granted"));
    act(() => setConsent("granted"));

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("view_home", { route: "/", source: "app_router" });
  });

  it("tracks each new route once and skips untracked routes", () => {
    setConsent("granted");
    const { rerender } = render(<AnalyticsProvider />);

    mockPathname = "/shop";
    rerender(<AnalyticsProvider />);
    rerender(<AnalyticsProvider />);
    mockPathname = "/play-ai";
    rerender(<AnalyticsProvider />);

    expect(mockTrack.mock.calls.map(([event]) => event)).toEqual(["view_home", "view_shop"]);
  });

  it("handles a null pathname without tracking", () => {
    setConsent("granted");
    mockPathname = null;
    render(<AnalyticsProvider />);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("stops tracking new routes after consent is withdrawn", () => {
    setConsent("granted");
    const { rerender } = render(<AnalyticsProvider />);
    act(() => setConsent("denied"));

    mockPathname = "/shop";
    rerender(<AnalyticsProvider />);

    expect(mockTrack).toHaveBeenCalledTimes(1);
  });
});
