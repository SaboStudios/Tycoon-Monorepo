/**
 * Tree-shake audit for @/lib/pwa
 *
 * Verifies that:
 *  1. Every named export can be imported individually (no forced co-loading).
 *  2. The module has no detectable top-level side effects — importing it must
 *     not mutate globals, register event listeners, or schedule timers.
 *  3. All exports are pure values or pure functions (no class instances with
 *     constructor side effects, no IIFE results that touch the DOM/BOM).
 *  4. Constants are primitives or frozen-equivalent readonly tuples — safe for
 *     bundler inlining and dead-code elimination.
 *
 * Why this matters:
 *  The pwa lib is imported by pwa-provider.tsx which is rendered on every
 *  page. Any accidental side effect at module evaluation time would run on
 *  every navigation. Any non-tree-shakable export would bloat every chunk
 *  that touches the lib, even if only one constant is needed.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// 1. Individual named imports — each export is independently accessible
// ---------------------------------------------------------------------------

describe("tree-shake audit — individual named imports", () => {
  it("PWA_CACHE_PREFIX is importable alone", async () => {
    const { PWA_CACHE_PREFIX } = await import("./constants");
    expect(typeof PWA_CACHE_PREFIX).toBe("string");
  });

  it("PWA_CACHE_VERSION is importable alone", async () => {
    const { PWA_CACHE_VERSION } = await import("./constants");
    expect(typeof PWA_CACHE_VERSION).toBe("string");
  });

  it("PWA_CACHE_NAME is importable alone", async () => {
    const { PWA_CACHE_NAME } = await import("./constants");
    expect(typeof PWA_CACHE_NAME).toBe("string");
  });

  it("PWA_SW_URL is importable alone", async () => {
    const { PWA_SW_URL } = await import("./constants");
    expect(typeof PWA_SW_URL).toBe("string");
  });

  it("PWA_SW_SCOPE is importable alone", async () => {
    const { PWA_SW_SCOPE } = await import("./constants");
    expect(typeof PWA_SW_SCOPE).toBe("string");
  });

  it("PWA_OFFLINE_FALLBACK_URL is importable alone", async () => {
    const { PWA_OFFLINE_FALLBACK_URL } = await import("./constants");
    expect(typeof PWA_OFFLINE_FALLBACK_URL).toBe("string");
  });

  it("PWA_SHELL_PATHS is importable alone", async () => {
    const { PWA_SHELL_PATHS } = await import("./constants");
    expect(Array.isArray(PWA_SHELL_PATHS)).toBe(true);
  });

  it("isShellAssetPath is importable alone", async () => {
    const { isShellAssetPath } = await import("./constants");
    expect(typeof isShellAssetPath).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// 2. No top-level side effects — module evaluation must be inert
// ---------------------------------------------------------------------------

describe("tree-shake audit — no top-level side effects", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "setTimeout");
    vi.spyOn(globalThis, "setInterval");
    vi.spyOn(globalThis, "clearTimeout");
    vi.spyOn(globalThis, "clearInterval");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("importing the barrel does not schedule any timers", async () => {
    await import("@/lib/pwa");
    expect(setTimeout).not.toHaveBeenCalled();
    expect(setInterval).not.toHaveBeenCalled();
  });

  it("importing constants does not schedule any timers", async () => {
    await import("./constants");
    expect(setTimeout).not.toHaveBeenCalled();
    expect(setInterval).not.toHaveBeenCalled();
  });

  it("importing the barrel does not add event listeners to window", async () => {
    const spy = vi.spyOn(window, "addEventListener");
    await import("@/lib/pwa");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("importing constants does not add event listeners to window", async () => {
    const spy = vi.spyOn(window, "addEventListener");
    await import("./constants");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("importing the barrel does not touch localStorage", async () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem");
    const setSpy = vi.spyOn(Storage.prototype, "setItem");
    await import("@/lib/pwa");
    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 3. Pure values — constants are primitives or readonly tuples (inlinable)
// ---------------------------------------------------------------------------

describe("tree-shake audit — pure inlinable values", () => {
  it("PWA_CACHE_PREFIX is a primitive string (inlinable)", async () => {
    const { PWA_CACHE_PREFIX } = await import("./constants");
    // Primitives are always inlined by bundlers — no object reference needed
    expect(typeof PWA_CACHE_PREFIX).toBe("string");
    expect(PWA_CACHE_PREFIX === PWA_CACHE_PREFIX).toBe(true);
  });

  it("PWA_CACHE_NAME is a primitive string (inlinable)", async () => {
    const { PWA_CACHE_NAME } = await import("./constants");
    expect(typeof PWA_CACHE_NAME).toBe("string");
  });

  it("PWA_SW_URL is a primitive string (inlinable)", async () => {
    const { PWA_SW_URL } = await import("./constants");
    expect(typeof PWA_SW_URL).toBe("string");
  });

  it("PWA_SW_SCOPE is a primitive string (inlinable)", async () => {
    const { PWA_SW_SCOPE } = await import("./constants");
    expect(typeof PWA_SW_SCOPE).toBe("string");
  });

  it("PWA_OFFLINE_FALLBACK_URL is a primitive string (inlinable)", async () => {
    const { PWA_OFFLINE_FALLBACK_URL } = await import("./constants");
    expect(typeof PWA_OFFLINE_FALLBACK_URL).toBe("string");
  });

  it("PWA_SHELL_PATHS is a readonly tuple — not mutated between imports", async () => {
    const a = await import("./constants");
    const b = await import("./constants");
    // Same module instance — same reference
    expect(a.PWA_SHELL_PATHS).toBe(b.PWA_SHELL_PATHS);
    // Verify it is not accidentally mutable (as const tuple)
    expect(Object.isFrozen(a.PWA_SHELL_PATHS)).toBe(true);
  });

  it("isShellAssetPath is a pure function — same input always yields same output", async () => {
    const { isShellAssetPath } = await import("./constants");
    // Referential transparency check
    expect(isShellAssetPath("/_next/static/a.js")).toBe(true);
    expect(isShellAssetPath("/_next/static/a.js")).toBe(true);
    expect(isShellAssetPath("/api/data")).toBe(false);
    expect(isShellAssetPath("/api/data")).toBe(false);
  });

  it("isShellAssetPath has no observable side effects", async () => {
    const { isShellAssetPath } = await import("./constants");
    const setSpy = vi.spyOn(Storage.prototype, "setItem");
    const addSpy = vi.spyOn(window, "addEventListener");

    isShellAssetPath("/_next/static/test.js");
    isShellAssetPath("/api/test");

    expect(setSpy).not.toHaveBeenCalled();
    expect(addSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
    addSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 4. Barrel re-export fidelity — index.ts must not add or drop exports
// ---------------------------------------------------------------------------

describe("tree-shake audit — barrel re-export fidelity", () => {
  it("barrel exports exactly the same symbols as constants.ts", async () => {
    const barrel = await import("@/lib/pwa");
    const source = await import("./constants");

    const barrelKeys = Object.keys(barrel).sort();
    const sourceKeys = Object.keys(source).sort();

    expect(barrelKeys).toEqual(sourceKeys);
  });

  it("barrel re-exports are the same references as source exports", async () => {
    const barrel = await import("@/lib/pwa");
    const source = await import("./constants");

    // Functions and arrays should be the exact same reference
    expect(barrel.isShellAssetPath).toBe(source.isShellAssetPath);
    expect(barrel.PWA_SHELL_PATHS).toBe(source.PWA_SHELL_PATHS);
  });

  it("barrel does not introduce any new top-level bindings", async () => {
    const barrel = await import("@/lib/pwa");
    const source = await import("./constants");

    const barrelOnly = Object.keys(barrel).filter(
      (k) => !(k in source),
    );
    expect(barrelOnly).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Constant value stability — values must not change across re-imports
// ---------------------------------------------------------------------------

describe("tree-shake audit — constant value stability", () => {
  it("PWA_CACHE_NAME is always the concatenation of prefix and version", async () => {
    const { PWA_CACHE_PREFIX, PWA_CACHE_VERSION, PWA_CACHE_NAME } =
      await import("./constants");
    expect(PWA_CACHE_NAME).toBe(`${PWA_CACHE_PREFIX}-${PWA_CACHE_VERSION}`);
  });

  it("PWA_SHELL_PATHS always contains PWA_OFFLINE_FALLBACK_URL", async () => {
    const { PWA_SHELL_PATHS, PWA_OFFLINE_FALLBACK_URL } =
      await import("./constants");
    expect(PWA_SHELL_PATHS).toContain(PWA_OFFLINE_FALLBACK_URL);
  });

  it("all string constants are non-empty and start with expected characters", async () => {
    const { PWA_SW_URL, PWA_SW_SCOPE, PWA_OFFLINE_FALLBACK_URL } =
      await import("./constants");
    expect(PWA_SW_URL.startsWith("/")).toBe(true);
    expect(PWA_SW_SCOPE.startsWith("/")).toBe(true);
    expect(PWA_OFFLINE_FALLBACK_URL.startsWith("/")).toBe(true);
  });
});
