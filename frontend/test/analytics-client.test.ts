import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ProviderWindow = Window & {
  plausible?: ReturnType<typeof vi.fn>;
  posthog?: { capture: ReturnType<typeof vi.fn> };
};

async function loadClient(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  vi.resetModules();
  const client = await import("@/lib/analytics/client");
  const consent = await import("@/lib/analytics/consent");
  return { ...client, ...consent };
}

describe("analytics client consent gating (#1761)", () => {
  let win: ProviderWindow;

  beforeEach(() => {
    window.localStorage.clear();
    win = window as ProviderWindow;
    win.plausible = vi.fn();
    win.posthog = { capture: vi.fn() };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete win.plausible;
    delete win.posthog;
  });

  it("emits nothing before consent, even when fully configured", async () => {
    const { track, canTrack } = await loadClient({
      NEXT_PUBLIC_ENABLE_ANALYTICS: "true",
      NEXT_PUBLIC_ANALYTICS_PROVIDERS: "plausible",
    });

    track("view_home", { route: "/" });

    expect(canTrack()).toBe(false);
    expect(win.plausible).not.toHaveBeenCalled();
  });

  it("emits a scrubbed payload once consent is granted", async () => {
    const { track, setConsent } = await loadClient({
      NEXT_PUBLIC_ENABLE_ANALYTICS: "true",
      NEXT_PUBLIC_ANALYTICS_PROVIDERS: "plausible,posthog",
    });
    setConsent("granted");

    track("view_shop", {
      route: "/shop?invite=abc123#token",
      source: "player@example.com",
      wallet_address: "alice.near",
    });

    expect(win.plausible).toHaveBeenCalledWith("view_shop", { props: { route: "/shop" } });
    expect(win.posthog?.capture).toHaveBeenCalledWith("view_shop", { route: "/shop" });
  });

  it("stops immediately when consent is withdrawn", async () => {
    const { track, setConsent } = await loadClient({
      NEXT_PUBLIC_ENABLE_ANALYTICS: "true",
      NEXT_PUBLIC_ANALYTICS_PROVIDERS: "plausible",
    });
    setConsent("granted");
    track("view_home", { route: "/" });
    setConsent("denied");
    track("view_home", { route: "/" });

    expect(win.plausible).toHaveBeenCalledTimes(1);
  });

  it("is off unless the master switch is exactly 'true'", async () => {
    for (const flag of ["", "false", "1", "yes"]) {
      const { track, setConsent, isAnalyticsConfigured } = await loadClient({
        NEXT_PUBLIC_ENABLE_ANALYTICS: flag,
        NEXT_PUBLIC_ANALYTICS_PROVIDERS: "plausible",
      });
      setConsent("granted");
      track("view_home", { route: "/" });
      expect(isAnalyticsConfigured()).toBe(false);
    }
    expect(win.plausible).not.toHaveBeenCalled();
  });

  it("fails closed when an unknown provider reaches the browser", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { track, setConsent, isAnalyticsConfigured } = await loadClient({
      NEXT_PUBLIC_ENABLE_ANALYTICS: "true",
      NEXT_PUBLIC_ANALYTICS_PROVIDERS: "plausible,unvetted",
    });
    setConsent("granted");
    track("view_home", { route: "/" });

    expect(isAnalyticsConfigured()).toBe(false);
    expect(win.plausible).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("a throwing provider global never breaks the caller or other providers", async () => {
    const { track, setConsent } = await loadClient({
      NEXT_PUBLIC_ENABLE_ANALYTICS: "true",
      NEXT_PUBLIC_ANALYTICS_PROVIDERS: "plausible,posthog",
    });
    setConsent("granted");
    win.plausible = vi.fn(() => {
      throw new Error("blocked by extension");
    });

    expect(() => track("view_home", { route: "/" })).not.toThrow();
    expect(win.posthog?.capture).toHaveBeenCalledTimes(1);
  });
});
