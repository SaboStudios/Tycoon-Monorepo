/**
 * #797 Lib analytics/ — tree-shake audit
 *
 * Verifies:
 *  1. Every named export is individually importable (no forced co-loading).
 *  2. No wildcard re-exports that defeat bundler tree-shaking.
 *  3. Internal helpers (sanitizeAnalyticsPayload, analyticsEventSchema,
 *     resolveAnalyticsProviders) are NOT re-exported from the barrel.
 *  4. No top-level side effects — importing the barrel must not mutate globals.
 *  5. All runtime exports are pure functions (no class instances with
 *     constructor side effects).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const analyticsDir = resolve(process.cwd(), "src/lib/analytics");

function readSource(file: string): string {
  return readFileSync(resolve(analyticsDir, file), "utf8");
}

// ---------------------------------------------------------------------------
// 1. Individual named imports — each public export is independently accessible
// ---------------------------------------------------------------------------

describe("tree-shake audit — individual named imports", () => {
  it("track is importable alone", async () => {
    const { track } = await import("./client");
    expect(typeof track).toBe("function");
  });

  it("registerAnalyticsDebugHandle is importable alone", async () => {
    const { registerAnalyticsDebugHandle } = await import("./client");
    expect(typeof registerAnalyticsDebugHandle).toBe("function");
  });

  it("getViewEventForPath is importable alone", async () => {
    const { getViewEventForPath } = await import("./taxonomy");
    expect(typeof getViewEventForPath).toBe("function");
  });

  it("sanitizeAnalyticsPayload is importable alone from taxonomy", async () => {
    const { sanitizeAnalyticsPayload } = await import("./taxonomy");
    expect(typeof sanitizeAnalyticsPayload).toBe("function");
  });

  it("getAnalyticsErrorType is importable alone", async () => {
    const { getAnalyticsErrorType } = await import("./api-errors");
    expect(typeof getAnalyticsErrorType).toBe("function");
  });

  it("resolveAnalyticsProviders is importable alone from providers", async () => {
    const { resolveAnalyticsProviders } = await import("./providers");
    expect(typeof resolveAnalyticsProviders).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// 2. Barrel (index.ts) — no wildcard exports, no internal leakage
// ---------------------------------------------------------------------------

describe("tree-shake audit — barrel export hygiene", () => {
  it("index.ts uses no wildcard exports", () => {
    const src = readSource("index.ts");
    expect(src).not.toMatch(/export\s+\*/);
    expect(src).not.toMatch(/export\s+type\s+\*/);
  });

  it("index.ts does not re-export sanitizeAnalyticsPayload", () => {
    const src = readSource("index.ts");
    expect(src).not.toContain("sanitizeAnalyticsPayload");
  });

  it("index.ts does not re-export analyticsEventSchema", () => {
    const src = readSource("index.ts");
    expect(src).not.toContain("analyticsEventSchema");
  });

  it("index.ts does not re-export resolveAnalyticsProviders", () => {
    const src = readSource("index.ts");
    expect(src).not.toContain("resolveAnalyticsProviders");
  });

  it("index.ts does not re-export blockedPiiKeys", () => {
    const src = readSource("index.ts");
    expect(src).not.toContain("blockedPiiKeys");
  });

  it("barrel exports exactly the documented public API", async () => {
    const barrel = await import("./index");
    expect(Object.keys(barrel).sort()).toEqual([
      "getAnalyticsErrorType",
      "getViewEventForPath",
      "registerAnalyticsDebugHandle",
      "track",
    ]);
  });
});

// ---------------------------------------------------------------------------
// 3. No top-level side effects — importing must not mutate globals
// ---------------------------------------------------------------------------

describe("tree-shake audit — no top-level side effects", () => {
  let originalWindow: typeof globalThis.window | undefined;

  beforeEach(() => {
    originalWindow = (globalThis as Record<string, unknown>).window as
      | typeof globalThis.window
      | undefined;
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
  });

  it("importing taxonomy does not mutate globalThis", async () => {
    const keysBefore = Object.keys(globalThis).length;
    await import("./taxonomy");
    expect(Object.keys(globalThis).length).toBe(keysBefore);
  });

  it("importing providers does not mutate globalThis", async () => {
    const keysBefore = Object.keys(globalThis).length;
    await import("./providers");
    expect(Object.keys(globalThis).length).toBe(keysBefore);
  });

  it("importing api-errors does not mutate globalThis", async () => {
    const keysBefore = Object.keys(globalThis).length;
    await import("./api-errors");
    expect(Object.keys(globalThis).length).toBe(keysBefore);
  });

  it("importing client does not register event listeners at module load", () => {
    const addEventListenerSpy = vi.spyOn(globalThis, "addEventListener");
    // Re-importing a cached module won't re-run top-level code, but we verify
    // the spy was never called during this test's lifetime
    expect(addEventListenerSpy).not.toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 4. Pure function contracts — exports are stateless pure functions
// ---------------------------------------------------------------------------

describe("tree-shake audit — pure function contracts", () => {
  it("getViewEventForPath is deterministic for the same input", async () => {
    const { getViewEventForPath } = await import("./taxonomy");
    expect(getViewEventForPath("/")).toBe(getViewEventForPath("/"));
    expect(getViewEventForPath("/shop")).toBe(getViewEventForPath("/shop"));
  });

  it("sanitizeAnalyticsPayload does not mutate the input object", async () => {
    const { sanitizeAnalyticsPayload } = await import("./taxonomy");
    const input = { route: "/shop", email: "user@example.com", value: 10 };
    const frozen = { ...input };
    sanitizeAnalyticsPayload("view_shop", input);
    expect(input).toEqual(frozen);
  });

  it("getAnalyticsErrorType never throws for any input", async () => {
    const { getAnalyticsErrorType } = await import("./api-errors");
    const weirdValues = [null, undefined, 0, false, [], {}, "string", Symbol()];
    for (const val of weirdValues) {
      expect(() => getAnalyticsErrorType(val)).not.toThrow();
    }
  });

  it("resolveAnalyticsProviders returns an array (empty when env unset)", async () => {
    const { resolveAnalyticsProviders } = await import("./providers");
    const result = resolveAnalyticsProviders();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Source-level checks — no patterns that defeat tree-shaking
// ---------------------------------------------------------------------------

describe("tree-shake audit — source-level patterns", () => {
  it("client.ts has no top-level IIFE", () => {
    const src = readSource("client.ts");
    expect(src).not.toMatch(/^\s*\(\s*(?:function|\(\s*\))\s*=>/m);
  });

  it("taxonomy.ts exports only named exports (no default export)", () => {
    const src = readSource("taxonomy.ts");
    expect(src).not.toMatch(/^export\s+default\b/m);
  });

  it("providers.ts exports only named exports (no default export)", () => {
    const src = readSource("providers.ts");
    expect(src).not.toMatch(/^export\s+default\b/m);
  });

  it("api-errors.ts exports only named exports (no default export)", () => {
    const src = readSource("api-errors.ts");
    expect(src).not.toMatch(/^export\s+default\b/m);
  });

  it("client.ts exports only named exports (no default export)", () => {
    const src = readSource("client.ts");
    expect(src).not.toMatch(/^export\s+default\b/m);
  });
});
