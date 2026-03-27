# Randomness audit — Tycoon Monorepo

**Date:** 2026-03-26  
**Conclusion:** **Safe or replaced** — see sections below.

## Soroban / WASM contracts (`contract/`)

| Finding | Risk | Mitigation |
|--------|------|------------|
| No `rand`, `random`, or PRNG APIs are used in contract Rust code. | — | N/A |
| `Env::ledger().sequence()` and `ledger().timestamp()` are used for IDs and time — **deterministic** from consensus. | Not randomness; predictable to validators (by design). | Acceptable for ordering and TTL; **not** used as game RNG. |

**Verdict:** On-chain logic does **not** rely on weak or predictable “random” for value transfer. Any future **fair** randomness (e.g. loot) must use **Stellar/Soroban VRF** or **commit–reveal** with documented flow — **security review required** before merging.

## Backend (NestJS)

| Location (before) | Issue | Change |
|-------------------|-------|--------|
| `games.service.ts` — game codes | `Math.random()` | `crypto.randomInt` per character via `secureRandomAlphaNumeric` |
| `chance.service.ts` — card draw | `Math.random()` for index | `secureRandomInt` + deterministic `order: { id: 'ASC' }` |
| `community-chest.service.ts` — `ORDER BY RANDOM()` | DB-dependent, not CSPRNG | Count + `skip` from `secureRandomInt` |
| `shop.service.ts` — transaction IDs | `Math.random()` in string | `crypto.randomBytes` (hex) |
| Admin upload filename (`Admin Shop Management APIs/.../upload.ts`) | `Math.random()` | `randomBytes` (hex suffix) |
| `database/seeds/seed-admin-logs.ts` | `Math.random()` for demo rows | `crypto.randomInt` (non-security bulk seed data) |

Shared helpers live in `backend/src/common/crypto-secure-random.ts` (Node `crypto`).

## Frontend

| Location | Issue | Change |
|----------|-------|--------|
| `useGameBoardLogic.ts` (stub) | `Math.random()` for dice | `crypto.getRandomValues` (browser CSPRNG) |

`GameSettings.tsx` and `PlayWithAISettings.tsx` mock lobby/game codes use `crypto.randomUUID()` (no `Math.random()`).

## Value-affected randomness

Any draw that affects **balances, prizes, or match outcome** must use **CSPRNG** (Node `crypto` / Web Crypto). For **trust-minimized** fairness against the server, consider **VRF** or **on-chain randomness** — out of scope for this audit but required before real-money rules.

## Tests

- `crypto-secure-random.spec.ts` — bounds and **`jest.mock('crypto')`** (not `spyOn`) so `randomInt` / `randomBytes` are deterministic under mock in Node 20+.
- `community-chest.service.spec.ts` — `drawCard` uses mocked `secureRandomInt` (skip `0`) + repository `count` / `find`.
- Card draw and similar flows can be unit-tested with mocked repository + mocked `crypto` for repeatable outcomes.

## Acceptance checklist

- [x] Unsafe `Math.random` removed from audited backend paths above (replaced with `crypto`).
- [x] Contracts: no unjustified random; documented as **safe / N/A**.
- [x] Threshold for “security review mandatory”: **on-chain RNG or any random that moves funds / ranking** — document + review before production.
