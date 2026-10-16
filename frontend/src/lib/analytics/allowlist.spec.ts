import { describe, expect, it } from "vitest";
import { ANALYTICS_PROVIDER_IDS, parseAnalyticsProviders } from "./allowlist";

describe("parseAnalyticsProviders", () => {
  it("parses a known provider id to the expected set", () => {
    const known = ANALYTICS_PROVIDER_IDS[0];
    const result = parseAnalyticsProviders(known);
    expect(result).toEqual(new Set([known]));
  });

  it("parses every known provider id", () => {
    const result = parseAnalyticsProviders(ANALYTICS_PROVIDER_IDS.join(","));
    expect(result).toEqual(new Set(ANALYTICS_PROVIDER_IDS));
  });

  it("fails on an unknown provider id", () => {
    expect(() => parseAnalyticsProviders("definitely-not-a-provider")).toThrow();
  });

  it("collapses duplicate entries", () => {
    const known = ANALYTICS_PROVIDER_IDS[0];
    const result = parseAnalyticsProviders(`${known},${known},${known}`);
    expect(result).toEqual(new Set([known]));
  });

  it("handles empty and whitespace input", () => {
    expect(parseAnalyticsProviders("")).toEqual(new Set());
    expect(parseAnalyticsProviders("   ")).toEqual(new Set());
    expect(parseAnalyticsProviders(" , , ")).toEqual(new Set());
  });

  it("trims whitespace around provider ids", () => {
    const known = ANALYTICS_PROVIDER_IDS[0];
    const result = parseAnalyticsProviders(`  ${known}  `);
    expect(result).toEqual(new Set([known]));
  });
});
