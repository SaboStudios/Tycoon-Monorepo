import React from "react";
import { renderToString } from "react-dom/server";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics/client", () => ({
  isAnalyticsConfigured: vi.fn(() => true),
  track: vi.fn(),
  canTrack: vi.fn(() => false),
  registerAnalyticsDebugHandle: vi.fn(),
}));

import { isAnalyticsConfigured } from "@/lib/analytics/client";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { AnalyticsConsentSettings } from "@/components/analytics/AnalyticsConsentSettings";
import {
  CONSENT_STORAGE_KEY,
  __resetConsentForTests,
  readConsent,
  setConsent,
} from "@/lib/analytics/consent";

const mockConfigured = isAnalyticsConfigured as ReturnType<typeof vi.fn>;

describe("ConsentBanner (#1761)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetConsentForTests();
    mockConfigured.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing on the server (no hydration mismatch, no SSR beacon UI)", () => {
    expect(renderToString(<ConsentBanner />)).toBe("");
  });

  it("asks for consent when analytics is configured and no decision exists", () => {
    render(<ConsentBanner />);
    const region = screen.getByRole("region", { name: /help us improve tycoon/i });
    expect(region).toHaveAccessibleDescription(/no wallet addresses, emails, or room codes/i);
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept analytics" })).toBeInTheDocument();
  });

  it("does not render when analytics is not configured (nothing to consent to)", () => {
    mockConfigured.mockReturnValue(false);
    const { container } = render(<ConsentBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render once a decision is stored", () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "denied");
    const { container } = render(<ConsentBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Accept stores 'granted' and dismisses; a double click is harmless", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />);
    const accept = screen.getByRole("button", { name: "Accept analytics" });

    await user.dblClick(accept);

    expect(readConsent()).toBe("granted");
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });

  it("Decline stores 'denied' and dismisses", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />);

    await user.click(screen.getByRole("button", { name: "Decline" }));

    expect(readConsent()).toBe("denied");
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });

  it("is keyboard operable in reading order: policy link -> Decline -> Accept", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />);

    await user.tab();
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Decline" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Accept analytics" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(readConsent()).toBe("granted");
  });

  it("does not steal focus on mount (non-modal)", () => {
    render(<ConsentBanner />);
    expect(document.body).toHaveFocus();
  });

  it("hides when consent is granted from another surface", () => {
    render(<ConsentBanner />);
    act(() => setConsent("granted"));
    expect(screen.queryByTestId("analytics-consent-banner")).not.toBeInTheDocument();
  });
});

describe("AnalyticsConsentSettings (#1761)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetConsentForTests();
  });

  it("lets a player grant, withdraw, and reset consent with status announcements", async () => {
    const user = userEvent.setup();
    render(<AnalyticsConsentSettings />);

    expect(screen.getByRole("status")).toHaveTextContent(/have not chosen yet/i);

    await user.click(screen.getByRole("button", { name: "Allow analytics" }));
    expect(readConsent()).toBe("granted");
    expect(screen.getByRole("status")).toHaveTextContent(/analytics are on/i);

    await user.click(screen.getByRole("button", { name: "Turn off analytics" }));
    expect(readConsent()).toBe("denied");
    expect(screen.getByRole("status")).toHaveTextContent(/nothing is sent/i);

    await user.click(screen.getByRole("button", { name: "Reset my choice" }));
    expect(readConsent()).toBe("unknown");
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });

  it("server-renders a same-height placeholder to avoid layout shift", () => {
    const html = renderToString(<AnalyticsConsentSettings />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("min-h-[5.5rem]");
  });
});
