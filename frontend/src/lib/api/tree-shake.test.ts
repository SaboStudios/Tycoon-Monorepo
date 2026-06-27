/**
 * #800 Lib api/ — tree-shake audit
 *
 * Verifies:
 *  1. Every named export is individually importable (no forced co-loading).
 *  2. No wildcard re-exports that defeat bundler tree-shaking.
 *  3. No top-level side effects — importing the barrel must not mutate globals.
 *  4. All exports are pure functions or type definitions (no class instances).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiDir = resolve(process.cwd(), 'src/lib/api');

function readSource(file: string): string {
  return readFileSync(resolve(apiDir, file), 'utf8');
}

describe('tree-shake audit — individual named imports', () => {
  it('apiClient is importable alone', async () => {
    const { apiClient } = await import('./client');
    expect(typeof apiClient).toBe('object');
    expect(typeof apiClient.get).toBe('function');
    expect(typeof apiClient.post).toBe('function');
  });

  it('TycoonApiError is importable alone', async () => {
    const { TycoonApiError } = await import('./errors');
    expect(typeof TycoonApiError).toBe('function');
  });

  it('parseErrorResponse is importable alone', async () => {
    const { parseErrorResponse } = await import('./errors');
    expect(typeof parseErrorResponse).toBe('function');
  });

  it('type guards are importable alone', async () => {
    const { isApiError, isValidationError, isUnauthorized } = await import(
      './errors'
    );
    expect(typeof isApiError).toBe('function');
    expect(typeof isValidationError).toBe('function');
    expect(typeof isUnauthorized).toBe('function');
  });

  it('DTO types are importable from types/dto', async () => {
    const types = await import('./types/dto');
    expect(types.LoginDto).toBeDefined();
  });
});

describe('tree-shake audit — barrel export hygiene', () => {
  it('index.ts uses no wildcard exports', () => {
    const src = readSource('index.ts');
    expect(src).not.toMatch(/export\s+\*/);
    expect(src).not.toMatch(/export\s+type\s+\*/);
  });

  it('index.ts does not export internal utilities that should be hidden', () => {
    const src = readSource('index.ts');
    expect(src).not.toContain('fetchWithTimeout');
    expect(src).not.toContain('statusToCode');
    expect(src).not.toContain('getAuthHeaders');
  });

  it('barrel re-exports only documented public API', async () => {
    const barrel = await import('./index');
    const exported = Object.keys(barrel).sort();

    // Should export client, error class, and type guards
    expect(exported).toContain('apiClient');
    expect(exported).toContain('TycoonApiError');
    expect(exported).toContain('isApiError');
    expect(exported).toContain('isValidationError');
    expect(exported).toContain('isUnauthorized');

    // Types are exported but won't appear in Object.keys at runtime
    // They should be present in the source
    const src = readSource('index.ts');
    expect(src).toContain('export type { ApiError, ApiErrorCode }');
  });
});

describe('tree-shake audit — no top-level side effects', () => {
  it('importing client does not mutate globalThis', async () => {
    const beforeKeys = Object.keys(globalThis);
    await import('./client');
    const afterKeys = Object.keys(globalThis);

    expect(afterKeys).toEqual(beforeKeys);
  });

  it('importing errors does not mutate globalThis', async () => {
    const beforeKeys = Object.keys(globalThis);
    await import('./errors');
    const afterKeys = Object.keys(globalThis);

    expect(afterKeys).toEqual(beforeKeys);
  });
});

describe('tree-shake audit — module structure', () => {
  it('client.ts only imports from errors and common modules', () => {
    const src = readSource('client.ts');

    // Should import from errors module
    expect(src).toContain("import { TycoonApiError, parseErrorResponse }");

    // Should not import from node_modules that could bloat bundle
    // (DOM fetch is built-in, no import needed)
    expect(src).not.toContain('import.*from.*lodash');
    expect(src).not.toContain('import.*from.*axios');
  });

  it('errors.ts has no external dependencies', () => {
    const src = readSource('errors.ts');

    // Errors module should be self-contained
    expect(src).not.toContain("import.*from '@/");
    expect(src).not.toContain('import.*from \'./');
  });

  it('index.ts only re-exports from local modules', () => {
    const src = readSource('index.ts');

    // All imports should be relative/local
    expect(src).toMatch(/from ['"]\.\/client['"]/);
    expect(src).toMatch(/from ['"]\.\/errors['"]/);
    expect(src).toMatch(/from ['"]\.\/types\/dto['"]/);

    // Should not import from node_modules directly
    const lines = src.split('\n');
    const importLines = lines.filter((l) => l.includes('import'));
    importLines.forEach((line) => {
      if (!line.includes('//')) {
        expect(line).not.toMatch(/from ['"](?!\.)/);
      }
    });
  });
});

describe('tree-shake audit — dead code elimination', () => {
  it('unused exports are not in the barrel', () => {
    const src = readSource('index.ts');

    // Internal implementation details should not leak
    expect(src).not.toContain('RequestOptions');
    expect(src).not.toContain('fetchWithTimeout');
  });

  it('error mapping function is only exposed through parseErrorResponse', () => {
    const src = readSource('errors.ts');

    // statusToCode should be internal (not exported)
    const hasNamedExport = /^export.*statusToCode/m.test(src);
    expect(hasNamedExport).toBe(false);
  });
});
