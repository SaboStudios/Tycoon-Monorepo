# Security Review Checklist — tycoon-lib (#1008)

**Issue:** #1008  
**Reviewer:** (assign before merge)  
**Date:** 2026-06-27  
**Crate:** `contract/contracts/tycoon-lib/`  
**SDK:** soroban-sdk 23  
**Version:** 0.1.0  

---

## Scope

`tycoon-lib` is a **shared types library** — it exposes no contract entrypoints,
holds no persistent state, and performs no auth operations. Its public API surface
consists of:

- `GameStatus` enum — lifecycle state of a game.
- `GameType` enum — public vs. private game.
- `PlayerSymbol` enum — board piece token.
- `fees` module — `FeeConfig`, `FeeSplit`, and `calculate_fee_split`.

Because there are no `#[contract]` / `#[contractimpl]` annotations and no storage
access, many checklist categories are N/A. They are recorded explicitly to confirm
this is intentional rather than overlooked.

---

## 1. Access Control

| # | Check | Status | Notes |
|---|---|---|---|
| AC-1 | No privileged entrypoints or admin roles | ✅ N/A | Library crate — no `#[contractimpl]` block |
| AC-2 | No `require_auth()` calls required | ✅ N/A | No state mutation; no auth surface |
| AC-3 | No re-initialization risk | ✅ N/A | No storage; no init function |

---

## 2. CEI (Checks-Effects-Interactions) Pattern

| # | Function | Status | Notes |
|---|---|---|---|
| CEI-1 | `calculate_fee_split` | ✅ N/A | Pure function; no external interactions |

---

## 3. Input Validation

| # | Check | Status | Notes |
|---|---|---|---|
| IV-1 | `calculate_fee_split` — `amount: u128`, no negative values possible | ✅ | Type-level guarantee |
| IV-2 | `FeeConfig.platform_fee_bps`, `creator_fee_bps`, `pool_fee_bps` — `u32`, no negative values | ✅ | Type-level guarantee |
| IV-3 | **No guard against total bps > 10 000** | ⚠️ See LIB-01 below | If the sum of all three fee bps exceeds 10 000, `total_distributed > amount`; `saturating_sub` prevents underflow on `residue`, but the caller will distribute more tokens than `amount`. |
| IV-4 | No username, symbol, or string inputs in this crate | ✅ N/A | Enum variants only |

---

## 4. Integer Arithmetic

| # | Check | Status | Notes |
|---|---|---|---|
| INT-1 | `calculate_fee_split` — multiplication `amount * fee_bps as u128` | ✅ | `fee_bps` is cast from `u32` to `u128` before multiplication; max value: `u32::MAX (4 294 967 295) * u128::MAX / 10 000` which would overflow. However, in practice `fee_bps ≤ 10 000` and `amount` is bounded by Stellar token supply (≤ i128::MAX ≈ 1.7 × 10³⁸). At `fee_bps = 10 000` and `amount = i128::MAX`, the product is `i128::MAX * 10 000` which overflows u128. See LIB-02. |
| INT-2 | `saturating_sub` used for residue calculation | ✅ | Prevents underflow when total fees > amount |
| INT-3 | Division by 10 000 is safe (never zero) | ✅ | Constant denominator |
| INT-4 | `platform_amount + creator_amount + pool_amount` addition in `calculate_fee_split` — no overflow guard | ⚠️ See LIB-02 | If fees sum to > 100%, the intermediate sum can exceed `amount` but stays within `u128` given Stellar supply bounds. For strictly valid configs (bps ≤ 10 000) it is safe. |

---

## 5. Storage & State Consistency

| # | Check | Status | Notes |
|---|---|---|---|
| ST-1 | No storage access | ✅ N/A | Library crate only |
| ST-2 | No `DataKey` enum | ✅ N/A | |

---

## 6. Event Emission

| # | Check | Status | Notes |
|---|---|---|---|
| EV-1 | No events emitted | ✅ N/A | Library crate — no `Env` usage in public API |

---

## 7. Privileged Roles

None. `tycoon-lib` has no privileged roles.

---

## 8. Denial-of-Service / Gas

| # | Check | Status | Notes |
|---|---|---|---|
| DOS-1 | `calculate_fee_split` — O(1), three multiplications and one subtraction | ✅ | |
| DOS-2 | No loops or storage reads | ✅ N/A | |

---

## 9. Stellar / Soroban Best Practices

| # | Check | Status | Notes |
|---|---|---|---|
| SBP-1 | `#![no_std]` | ✅ | Confirmed in `src/lib.rs` |
| SBP-2 | `#[contracttype]` on `FeeConfig`, `FeeSplit` | ✅ | Required for cross-contract ABI compatibility |
| SBP-3 | `#[contracttype]` on `GameStatus`, `GameType`, `PlayerSymbol` | ✅ | Shared enums correctly attributed |
| SBP-4 | `overflow-checks = true` in workspace release profile | ✅ | Workspace `Cargo.toml` |
| SBP-5 | No `unsafe` blocks | ✅ | |
| SBP-6 | No `std` features | ✅ | |
| SBP-7 | `soroban-sdk` version pinned at workspace level | ✅ | `soroban-sdk = "23"` |
| SBP-8 | crate-type is `["lib"]` only (no `cdylib`) | ✅ | Not deployed as a standalone contract; used as a dependency only |

---

## 10. Test Coverage

| # | Check | Status | Notes |
|---|---|---|---|
| TC-1 | `GameStatus` variant equality and distinctness | ✅ | `src/lib.rs` test module |
| TC-2 | `GameType` variant equality and distinctness | ✅ | `src/lib.rs` test module |
| TC-3 | `PlayerSymbol` — all 8 variants compile and are distinct | ✅ | `src/lib.rs` test module |
| TC-4 | Clone behaviour for all types | ✅ | `src/lib.rs` test module |
| TC-5 | `GameStatus` used in match — exhaustive | ✅ | `src/lib.rs` test module |
| TC-6 | `GameType` used in match — exhaustive | ✅ | `src/lib.rs` test module |
| TC-7 | `PlayerSymbol` used in match — exhaustive | ✅ | `src/lib.rs` test module |
| TC-8 | `calculate_fee_split` sum invariant (multiple amounts) | ✅ | `src/fees.rs` inline tests |
| TC-9 | Zero-fee config | ✅ | `src/fees.rs` inline tests |
| TC-10 | Rounding residue (33.33% case) | ✅ | `src/fees.rs` inline tests |
| TC-11 | 100% fee total — no residue | ✅ | `src/fees_coverage_tests.rs` |
| TC-12 | Total fees > 100% — saturating residue | ✅ | `src/fees_coverage_tests.rs` |
| TC-13 | Large amount near u128 ceiling | ✅ | `src/fees_coverage_tests.rs` |
| TC-14 | Single fee component | ✅ | `src/fees_coverage_tests.rs` |
| TC-15 | Amount = 1 (minimum unit) | ✅ | `src/fees_coverage_tests.rs` |
| TC-16 | Symmetric three-way split | ✅ | `src/fees_coverage_tests.rs` |
| TC-17 | Platform takes 100% | ✅ | `src/fees_coverage_tests.rs` |
| TC-18 | Table-driven invariant suite | ✅ | `src/fees_coverage_tests.rs` |

---

## 11. Open Items

| ID | Severity | Description | Recommendation |
|---|---|---|---|
| LIB-01 | Medium | `FeeConfig` has no validation that the sum of `platform_fee_bps + creator_fee_bps + pool_fee_bps ≤ 10 000`. If misconfigured, callers will distribute more tokens than `amount`. | Add a `FeeConfig::validate(&self) -> bool` method that callers must invoke before using the config; or add a `FeeConfig::new(...)` constructor that panics on invalid totals. |
| LIB-02 | Low | `amount * fee_bps as u128` can overflow `u128` if `amount` is very large (> `u128::MAX / fee_bps`). In practice Stellar token amounts are bounded by `i128::MAX`, so for `fee_bps ≤ 10 000` the product is at most `i128::MAX * 10 000 ≈ 1.7e42` which exceeds `u128::MAX (≈ 3.4e38)`. This is a theoretical overflow for extreme inputs. | Use `amount.checked_mul(fee_bps as u128).expect("overflow")` or cap `amount` at `i128::MAX as u128 / 10_000` at call sites. |
| LIB-03 | Info | No `FeeConfig` constructor — callers build the struct directly, including the `platform_address` and `pool_address` fields that are never validated for correctness. | Consider a `FeeConfig::new(...)` constructor with validation. |

---

## 12. Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Smart Contract Dev | | | |
| Tech Lead | | | |
| Security Reviewer | | | |
| External Auditor | | | (pending) |
