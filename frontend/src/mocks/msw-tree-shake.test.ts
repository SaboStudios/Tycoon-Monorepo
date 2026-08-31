/**
 * #1462 MSW tree-shake audit — assert MSW is excluded from production bundles
 *
 * msw-provider.tsx gates on `process.env.NODE_ENV !== "development"` AND
 * `NEXT_PUBLIC_API_MOCKING`. A bad import can still ship the mock worker to
 * production, intercepting real purchase traffic.
 *
 * These tests enforce:
 *  1. `msw-provider.tsx` only imports from `@/mocks/browser` inside the
 *     dynamic import path (never at the top-level).
 *  2. `browser.ts` itself is NOT imported by any production-app source file
 *     at the module level — only via the dynamic import inside MSWProvider.
 *  3. `msw/browser` (the MSW service-worker bootstrap) is not reachable from
 *     any server-component or layout file via a static import chain.
 *  4. The guard condition in msw-provider.tsx references both NODE_ENV and
 *     the mocking flag so the worker cannot slip in via misconfiguration.
 *  5. No MSW handler file is imported outside of the `src/mocks/` directory.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd(), "src");
const MOCKS_DIR = resolve(ROOT, "mocks");
const MSW_PROVIDER_PATH = resolve(
  ROOT,
  "components/providers/msw-provider.tsx",
);
const BROWSER_TS_PATH = resolve(MOCKS_DIR, "browser.ts");
const LAYOUT_PATH = resolve(ROOT, "app/layout.tsx");

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

// Recursively collect all .ts/.tsx source files outside src/mocks/
function collectAppSourceFiles(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip the mocks dir itself — we only care about app source leaking MSW
      if (full === MOCKS_DIR) continue;
      collectAppSourceFiles(full, results);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 1. msw-provider.tsx — browser.ts must only be dynamically imported
// ---------------------------------------------------------------------------

describe("MSW tree-shake audit — msw-provider.tsx", () => {
  it("does not statically import @/mocks/browser at the top level", () => {
    const src = readSource(MSW_PROVIDER_PATH);
    // Top-level static import would be: import ... from '@/mocks/browser'
    expect(src).not.toMatch(/^import\s+.*from\s+['"]@\/mocks\/browser['"]/m);
  });

  it("uses dynamic import('@/mocks/browser') inside the effect", () => {
    const src = readSource(MSW_PROVIDER_PATH);
    expect(src).toMatch(/import\s*\(\s*['"]@\/mocks\/browser['"]\s*\)/);
  });

  it("guards on NODE_ENV !== 'development' before starting the worker", () => {
    const src = readSource(MSW_PROVIDER_PATH);
    // Must reference NODE_ENV so the prod-build dead-code eliminator can drop it
    expect(src).toMatch(/NODE_ENV/);
    expect(src).toMatch(/development/);
  });

  it("also guards on NEXT_PUBLIC_API_MOCKING so explicit override still works", () => {
    const src = readSource(MSW_PROVIDER_PATH);
    expect(src).toMatch(/NEXT_PUBLIC_API_MOCKING/);
  });

  it("calls worker.stop() in the cleanup path so stale workers are torn down", () => {
    const src = readSource(MSW_PROVIDER_PATH);
    expect(src).toMatch(/worker\.stop\(\)/);
  });
});

// ---------------------------------------------------------------------------
// 2. browser.ts — only sets up the service-worker, no top-level side effects
// ---------------------------------------------------------------------------

describe("MSW tree-shake audit — src/mocks/browser.ts", () => {
  it("imports from 'msw/browser', not 'msw' (browser-only entrypoint)", () => {
    const src = readSource(BROWSER_TS_PATH);
    expect(src).toMatch(/from\s+['"]msw\/browser['"]/);
  });

  it("does not call worker.start() at the top level (no side effects)", () => {
    const src = readSource(BROWSER_TS_PATH);
    // Top-level .start() call would mean the worker boots on every import
    expect(src).not.toMatch(/^worker\.start\(/m);
    expect(src).not.toMatch(/void\s+worker\.start\(/m);
  });

  it("exports 'worker' as a named export (not default) for tree-shake friendliness", () => {
    const src = readSource(BROWSER_TS_PATH);
    expect(src).toMatch(/export\s+(const\s+)?worker\b/);
    expect(src).not.toMatch(/^export\s+default\b/m);
  });
});

// ---------------------------------------------------------------------------
// 3. App source files — no file outside src/mocks/ statically imports browser.ts
// ---------------------------------------------------------------------------

describe("MSW tree-shake audit — no static mocks/browser leak into app source", () => {
  it("no app source file outside src/mocks/ statically imports @/mocks/browser", () => {
    const appFiles = collectAppSourceFiles(ROOT);
    const violators = appFiles.filter((file) => {
      const src = readSource(file);
      // Match top-level static import: import ... from '@/mocks/browser'
      return /import\s+.*from\s+['"]@\/mocks\/browser['"]/m.test(src);
    });
    expect(violators).toEqual([]);
  });

  it("layout.tsx does not statically import msw or @/mocks/browser", () => {
    const src = readSource(LAYOUT_PATH);
    expect(src).not.toMatch(/import\s+.*from\s+['"]msw['"]/);
    expect(src).not.toMatch(/import\s+.*from\s+['"]msw\/browser['"]/);
    expect(src).not.toMatch(/import\s+.*from\s+['"]@\/mocks\/browser['"]/);
  });
});

// ---------------------------------------------------------------------------
// 4. MSW handler files — must stay inside src/mocks/
// ---------------------------------------------------------------------------

describe("MSW tree-shake audit — handler file containment", () => {
  it("no app source file outside src/mocks/ statically imports from src/mocks/handlers", () => {
    const appFiles = collectAppSourceFiles(ROOT);
    const violators = appFiles.filter((file) => {
      const src = readSource(file);
      return /import\s+.*from\s+['"]@\/mocks\/handlers/m.test(src) ||
             /import\s+.*from\s+['"]@\/mocks\/joinRoomHandlers/m.test(src);
    });
    expect(violators).toEqual([]);
  });

  it("no app source file outside src/mocks/ statically imports from msw/browser", () => {
    const appFiles = collectAppSourceFiles(ROOT);
    const violators = appFiles.filter((file) => {
      const src = readSource(file);
      return /import\s+.*from\s+['"]msw\/browser['"]/m.test(src);
    });
    expect(violators).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. msw-provider.tsx — "use client" boundary declared (required for dynamic import)
// ---------------------------------------------------------------------------

describe("MSW tree-shake audit — client boundary", () => {
  it("msw-provider.tsx has 'use client' directive so it never runs on the server", () => {
    const src = readSource(MSW_PROVIDER_PATH);
    expect(src.trimStart()).toMatch(/^["']use client["']/);
  });
});
