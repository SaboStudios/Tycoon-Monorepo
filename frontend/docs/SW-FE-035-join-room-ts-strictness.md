# SW-FE-035 — Join Room Flow: TypeScript Strictness & Null Guards

Part of the **Stellar Wave** engineering batch.

## Problem

Three type-safety gaps existed in the join-room flow under `strict: true`:

| Location | Issue |
|----------|-------|
| `serverErrorMap.ts` — `mapServerErrors` | `error as ServerErrorResponse` was an unsafe cast. If `error` was `null`, a string, or a `DOMException`, accessing `.errors` / `.message` would throw at runtime. |
| `serverErrorMap.ts` — message array branch | `body?.message` array items were iterated as `string` without filtering; a non-string entry (e.g. a number from a malformed response) would silently produce `NaN`-keyed errors. |
| `JoinRoomForm.tsx` — `handleSubmit` | Zod error mapping was inlined with an untyped accumulator. `React.FormEvent` was ungeneric (should be `React.FormEvent<HTMLFormElement>`). `err` in the catch block was passed directly to `mapServerErrors` without narrowing `Error` instances first. |

## Changes

| File | Change |
|------|--------|
| `src/lib/validation/serverErrorMap.ts` | Added `isServerErrorResponse` type-guard; replaced unsafe cast with narrowed `body` variable; added `string` predicate filter on message array items. |
| `src/components/settings/JoinRoomForm.tsx` | Extracted `parseZodErrors(error: ZodError): FieldErrors` helper with explicit return type; tightened `React.FormEvent<HTMLFormElement>`; narrowed `err` in catch (`err instanceof Error ? { message: err.message } : err`). |
| `test/JoinRoomForm.e2e.test.tsx` | 7 new unit tests for `mapServerErrors` covering: `null`, plain string, `undefined`, explicit errors array, NestJS string[] keyword mapping, non-string array filtering, and `_form` fallback. |

### Diff summary

```ts
// serverErrorMap.ts — type-guard replaces unsafe cast
function isServerErrorResponse(v: unknown): v is ServerErrorResponse {
  return typeof v === "object" && v !== null;
}
export function mapServerErrors(error: unknown): FieldErrors {
  if (!isServerErrorResponse(error)) return { _form: "An unexpected error occurred" };
  const body: ServerErrorResponse = error;
  // ...
  const messages: string[] = Array.isArray(raw)
    ? raw.filter((m): m is string => typeof m === "string")
    : typeof raw === "string" ? [raw] : [];
}

// JoinRoomForm.tsx — extracted helper + tightened generics
function parseZodErrors(error: ZodError): FieldErrors { ... }

async (e: React.FormEvent<HTMLFormElement>) => { ... }

} catch (err: unknown) {
  setErrors(mapServerErrors(err instanceof Error ? { message: err.message } : err));
}
```

## New tests

```
mapServerErrors
  ✓ returns _form fallback for null
  ✓ returns _form fallback for a plain string
  ✓ returns _form fallback for undefined
  ✓ maps explicit errors array to fields
  ✓ maps NestJS string[] message to field via keyword
  ✓ filters non-string entries in message array
  ✓ maps plain string message to _form when no keyword matches
```

## No new dependencies

Pure TypeScript changes. No new packages, no bundle impact.

## Feature flag / rollout

No runtime flag needed. All changes are type-level or defensive runtime guards with identical happy-path behaviour.

1. `npm run typecheck` — must pass with zero new errors.
2. `npm run test` — all existing + 7 new tests must pass.
3. Deploy to preview; no observable behaviour change for end users.

**Rollback**: revert this single commit. No data migration required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-035
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 7 new regression cases
- [x] No new production dependencies
- [x] `mapServerErrors` is safe against `null`, `undefined`, and non-object errors
- [x] Message array items are filtered to `string` before use
- [x] `handleSubmit` event is typed as `React.FormEvent<HTMLFormElement>`
- [x] `err` in catch is narrowed before being passed to `mapServerErrors`
