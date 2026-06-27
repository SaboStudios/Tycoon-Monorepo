# Tree-shake audit — `lib/pwa/`

## Summary

All exports in `frontend/src/lib/pwa/` are safe for tree-shaking by Next.js
(webpack/Turbopack) and any ESM-aware bundler. No changes to runtime behaviour
were required; the audit confirmed the module was already structured correctly.

---

## Audit findings

### ✅ No top-level side effects

Importing `@/lib/pwa` (or `@/lib/pwa/constants` directly) does **not**:

- Schedule timers (`setTimeout` / `setInterval`)
- Register event listeners (`window.addEventListener`)
- Read or write `localStorage` / `sessionStorage`
- Touch the DOM
- Make network requests

This means bundlers can safely evaluate the module at build time and eliminate
any export that is not referenced by the consuming chunk.

### ✅ All exports are pure named exports

| Export | Type | Tree-shakable |
|---|---|---|
| `PWA_CACHE_PREFIX` | `string` primitive | ✅ inlinable |
| `PWA_CACHE_VERSION` | `string` primitive | ✅ inlinable |
| `PWA_CACHE_NAME` | `string` primitive | ✅ inlinable |
| `PWA_SW_URL` | `string` primitive | ✅ inlinable |
| `PWA_SW_SCOPE` | `string` primitive | ✅ inlinable |
| `PWA_OFFLINE_FALLBACK_URL` | `string` primitive | ✅ inlinable |
| `PWA_SHELL_PATHS` | `readonly string[]` tuple | ✅ static array |
| `isShellAssetPath` | pure function | ✅ no closure over mutable state |

String primitives are inlined directly by webpack's `ModuleConcatenationPlugin`
(scope hoisting). The `PWA_SHELL_PATHS` tuple is `as const` — its elements are
literal types, so bundlers can inline individual lookups.

`isShellAssetPath` closes over `PWA_SHELL_PATHS` but that array is module-level
and never mutated, so the function is referentially transparent.

### ✅ Strict barrel — no wildcard re-exports

`index.ts` uses explicit named re-exports only:

```ts
export { PWA_CACHE_PREFIX, PWA_CACHE_VERSION, ... } from "./constants";
```

Wildcard `export *` prevents bundlers from statically analysing which symbols
are used. Named re-exports allow full dead-code elimination.

### ✅ `"type": "module"` in package.json

The frontend package declares `"type": "module"`, which means all `.ts` files
are treated as ESM. ESM is a prerequisite for static tree-shaking — CommonJS
`require()` calls are dynamic and cannot be tree-shaken.

### ✅ No class instances at module scope

No `export const x = new SomeClass()` patterns exist. Class constructors can
have side effects that bundlers cannot eliminate. All exports are either
primitive literals, a `const` array, or a function declaration.

---

## What is NOT tree-shakable (by design)

`public/sw.js` — the service worker — is a plain JavaScript file served
directly by Next.js. It intentionally duplicates the cache constants from
`constants.ts` because service workers cannot import TypeScript modules.
This duplication is correct and expected; it is not a tree-shaking concern.

---

## How to maintain tree-shakability

When adding new exports to `lib/pwa/`:

1. **Prefer primitive constants** over object literals where possible.
2. **Never add top-level imperative code** (function calls, `new`, event
   listeners) outside of exported function bodies.
3. **Always use named re-exports** in `index.ts` — never `export *`.
4. **Run the tree-shake audit tests** after any change:
   ```bash
   npx vitest run src/lib/pwa/tree-shake.test.ts
   ```

---

## Test coverage

`src/lib/pwa/tree-shake.test.ts` verifies:

- Each export is individually importable (no forced co-loading)
- Module evaluation does not schedule timers or register listeners
- Module evaluation does not touch `localStorage`
- `PWA_SHELL_PATHS` is frozen (not accidentally mutable)
- `isShellAssetPath` is a pure function with no observable side effects
- Barrel re-exports are the exact same references as source exports
- Barrel does not introduce any extra bindings beyond `constants.ts`
- Constant values are stable across re-imports
