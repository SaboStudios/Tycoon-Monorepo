import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_PROVIDER_IDS,
  AnalyticsConfigError,
  assertAnalyticsBuildEnv,
  parseAnalyticsEnabledFlag,
  parseAnalyticsProviders,
} from "@/lib/analytics/allowlist";
import { resolveAnalyticsProviders } from "@/lib/analytics/providers";

describe("parseAnalyticsProviders (#1761)", () => {
  it("treats empty / whitespace / undefined as analytics off", () => {
    expect(parseAnalyticsProviders(undefined)).toEqual([]);
    expect(parseAnalyticsProviders("")).toEqual([]);
    expect(parseAnalyticsProviders("  ,  ")).toEqual([]);
  });

  it("accepts every registered id, normalising case and de-duplicating", () => {
    expect(parseAnalyticsProviders(ANALYTICS_PROVIDER_IDS.join(","))).toEqual([
      ...ANALYTICS_PROVIDER_IDS,
    ]);
    expect(parseAnalyticsProviders(" Plausible, plausible ,GA4")).toEqual(["plausible", "ga4"]);
  });

  it("rejects unknown ids and names them in the error", () => {
    expect(() => parseAnalyticsProviders("plausible,plausable")).toThrow(AnalyticsConfigError);
    expect(() => parseAnalyticsProviders("google-analytics")).toThrow(/google-analytics/);
    expect(() => parseAnalyticsProviders("segment")).toThrow(/Allowed values: plausible, ga4, posthog/);
  });

  it("rejects prototype-ish and adversarial ids", () => {
    for (const hostile of ["__proto__", "constructor", "toString", "posthog;alert(1)"]) {
      expect(() => parseAnalyticsProviders(hostile)).toThrow(AnalyticsConfigError);
    }
  });

  it("rejects oversized values", () => {
    expect(() => parseAnalyticsProviders("plausible,".repeat(40))).toThrow(/longer than/);
  });
});

describe("parseAnalyticsEnabledFlag", () => {
  it("only enables on the literal 'true'", () => {
    expect(parseAnalyticsEnabledFlag("true")).toBe(true);
    expect(parseAnalyticsEnabledFlag(" true ")).toBe(true);
    expect(parseAnalyticsEnabledFlag("false")).toBe(false);
    expect(parseAnalyticsEnabledFlag("")).toBe(false);
    expect(parseAnalyticsEnabledFlag(undefined)).toBe(false);
  });

  it("throws on ambiguous values instead of guessing", () => {
    for (const value of ["1", "yes", "TRUE", "on"]) {
      expect(() => parseAnalyticsEnabledFlag(value)).toThrow(AnalyticsConfigError);
    }
  });
});

describe("assertAnalyticsBuildEnv", () => {
  it("returns the parsed configuration when valid", () => {
    expect(
      assertAnalyticsBuildEnv({
        NEXT_PUBLIC_ENABLE_ANALYTICS: "true",
        NEXT_PUBLIC_ANALYTICS_PROVIDERS: "posthog",
      }),
    ).toEqual({ enabled: true, providers: ["posthog"] });
    expect(assertAnalyticsBuildEnv({})).toEqual({ enabled: false, providers: [] });
  });

  it("throws on an unknown provider even when analytics is switched off", () => {
    expect(() =>
      assertAnalyticsBuildEnv({
        NEXT_PUBLIC_ENABLE_ANALYTICS: "false",
        NEXT_PUBLIC_ANALYTICS_PROVIDERS: "mixpanel",
      }),
    ).toThrow(/mixpanel/);
  });
});

describe("next.config.ts build gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails config evaluation (and therefore `next build`) on an unknown provider", async () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_PROVIDERS", "plausible,unvetted-tracker");
    vi.resetModules();
    await expect(import("../next.config")).rejects.toThrow(/unvetted-tracker/);
  });

  it("loads normally with a valid provider list", async () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_PROVIDERS", "plausible");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ANALYTICS", "true");
    vi.resetModules();
    const mod = await import("../next.config");
    expect(typeof mod.default.headers).toBe("function");
  });
});

describe("resolveAnalyticsProviders (runtime)", () => {
  it("builds one provider per configured id", () => {
    expect(resolveAnalyticsProviders("plausible,posthog").map((p) => p.name)).toEqual([
      "plausible",
      "posthog",
    ]);
  });

  it("fails closed (no providers) instead of crashing when an unknown id slips through", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveAnalyticsProviders("plausible,evil")).toEqual([]);
    errorSpy.mockRestore();
  });
});
