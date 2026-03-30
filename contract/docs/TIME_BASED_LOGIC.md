# Time-Based Logic: Block Height vs Timestamp

This document defines which time source is authoritative for each on-chain operation, states
drift assumptions, and explains how game design aligns with on-chain time.

---

## Authoritative Time Sources

Soroban exposes two time primitives:

| Primitive | API | Unit | Drift |
|---|---|---|---|
| **Ledger sequence** | `env.ledger().sequence()` | Ledger number (u32) | ~5 s/ledger (target), ±2 s typical |
| **Ledger timestamp** | `env.ledger().timestamp()` | Unix seconds (u64) | Derived from validator consensus; not wall-clock |

**Rule: no contract may use wall-clock time.** All time-dependent logic must use one of the two
primitives above. The choice between them is determined by the semantic meaning of the operation.

---

## Per-Contract Time Source Decisions

### tycoon-boost-system — `expires_at_ledger: u32`

**Source: ledger sequence.**

Boost expiry is expressed as a ledger sequence number. This is the correct choice because:

- Boosts are a game mechanic with a duration measured in "turns" or "rounds", not calendar time.
- Ledger sequence is monotonically increasing and cannot be manipulated by validators within the
  consensus rules.
- Comparing `expires_at_ledger <= env.ledger().sequence()` is a single integer comparison with no
  drift ambiguity.

**Drift assumption:** At ~5 s/ledger, 1 000 ledgers ≈ 83 minutes. Boost durations should be
specified in ledgers by the game backend, not in seconds, to avoid drift accumulating over long
periods.

**Never-expiring sentinel:** `expires_at_ledger == 0` means the boost never expires. This is
explicitly documented in the `Boost` struct and tested.

---

### tycoon-game — `registered_at: u64` and `id: u64`

**Source: ledger timestamp (`registered_at`) and ledger sequence (`id`).**

- `registered_at` uses `env.ledger().timestamp()` — a Unix-seconds value suitable for display
  ("registered on date X") and off-chain analytics. It is **not** used for any on-chain
  comparison or expiry logic, so drift is acceptable.
- `id` uses `env.ledger().sequence() as u64` — a cheap, unique-enough surrogate key for the user
  record. It is not a cryptographic identifier; uniqueness is guaranteed because only one
  registration per address is allowed.

**Drift assumption:** `registered_at` may differ from wall-clock time by up to ~6 s per ledger
under normal network conditions. This is acceptable for a display field.

---

### tycoon-main-game — pause expiry

**Source: ledger sequence for expiry (`PauseExpiry: u32`), ledger timestamp for audit log
(`PausedAt: u64`, `unpaused_at`).**

- `PauseExpiry` is a ledger sequence number. The auto-expiry check
  `env.ledger().sequence() >= expiry` is a pure integer comparison — no drift.
- `PausedAt` and `unpaused_at` are timestamps used only for the emitted event and off-chain
  audit trail. They are **not** used in any on-chain guard.
- `paused_duration` (emitted in the unpause event) is computed as
  `unpaused_at.saturating_sub(paused_at)` — a best-effort human-readable duration for logs only.

**Drift assumption:** Pause duration in seconds (from timestamps) may drift by up to
`~6 s × duration_in_ledgers`. For a 1 000-ledger pause this is ±~6 000 s worst case. This is
acceptable because the authoritative expiry is the ledger sequence, not the timestamp.

---

## Drift Assumptions Summary

| Contract | Field | Source | Used for on-chain guard? | Acceptable drift |
|---|---|---|---|---|
| tycoon-boost-system | `expires_at_ledger` | ledger sequence | Yes | None — integer comparison |
| tycoon-game | `registered_at` | ledger timestamp | No (display only) | ±6 s/ledger |
| tycoon-game | `id` | ledger sequence | No (surrogate key) | None |
| tycoon-main-game | `PauseExpiry` | ledger sequence | Yes | None — integer comparison |
| tycoon-main-game | `PausedAt` / `unpaused_at` | ledger timestamp | No (audit log only) | ±6 s/ledger |

---

## Game Design Alignment

| Game mechanic | On-chain representation | Time source | Notes |
|---|---|---|---|
| Boost duration | `expires_at_ledger` (ledger count) | Ledger sequence | Backend converts "N minutes" → ledgers before submitting |
| Permanent boost | `expires_at_ledger == 0` | N/A | Sentinel value; never expires |
| Pause auto-expiry | `PauseExpiry` (ledger count) | Ledger sequence | Minimum 1 000 ledgers enforced |
| User registration date | `registered_at` (Unix seconds) | Ledger timestamp | Display only; not used in game logic |

**Backend responsibility:** The game backend must convert human-readable durations (minutes,
hours) into ledger counts before calling `add_boost` or `pause`. Use the formula:

```
ledgers = ceil(duration_seconds / 5)
```

This assumes the 5 s/ledger target. Add a safety margin (e.g. 10 %) for network variance.

---

## Edge Cases & Boundary Conditions

| Scenario | Behaviour | Tested |
|---|---|---|
| `expires_at_ledger == current_ledger` | Boost is expired (strict `<=` check) | Yes — `test_expiry_boundary_at_exact_ledger` |
| `expires_at_ledger == current_ledger - 1` | Boost is expired | Yes — `test_expiry_boundary_one_before` |
| `expires_at_ledger == current_ledger + 1` | Boost is active | Yes — `test_expiry_boundary_one_after` |
| `expires_at_ledger == 0` | Boost never expires | Yes — `test_expiry_never_expires_sentinel` |
| Ledger advances mid-session past expiry | Boost treated as expired on next call | Yes — `test_expiry_ledger_advance_mid_session` |
| `registered_at` at ledger 0 (genesis) | Timestamp is 0; valid u64 | Yes — `test_registration_at_genesis_ledger` |
| Pause expiry at exact ledger | Contract auto-unpauses | Covered by tycoon-main-game storage tests |

See `contract/contracts/tycoon-boost-system/src/time_boundary_tests.rs` for the edge-case tests.
