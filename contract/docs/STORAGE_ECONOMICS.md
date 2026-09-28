# Storage Economics — Tycoon Contracts

## Why this matters

Soroban storage carries a **rent** cost over time: every entry stored on ledger
must have its TTL (time-to-live) extended periodically. The more entries a
contract creates and the longer it keeps them alive, the higher the ongoing
operational cost. **Storage is not free**, and unbounded storage patterns can
make a contract economically unsustainable.

## Storage types

Soroban offers three storage tiers, each with different cost and lifetime
characteristics:

| Type | Key namespace | Lifetime | Best for |
|------|---------------|----------|----------|
| `Instance` | Per-contract singleton | Lives as long as the contract instance | Config/state that lives forever (admin, token addresses, version) |
| `Persistent` | Arbitrary keys | Extends TTL every time it's touched; lives until bumped or contract removed | Long-lived user data (balances, allowances, ownership) |
| `Temporary` | Arbitrary keys | Fixed TTL; cheaper but must be re-created after expiry | Ephemeral data (session tokens, nonces, cached computations) |

## Guiding principles

1. **Use `Instance` for configuration, not data** — Admin addresses, token
   contract IDs, pause flags, and state versions go in instance storage.
   Instance entries live for the contract's entire lifetime and incur the
   fixed base rent. Do not store per-user or per-token values here.

2. **Use `Persistent` for user-facing balances and ownership** — Balances,
   allowances, collectible metadata, and user profiles belong in persistent
   storage. Every read or write of a persistent key implicitly extends its
   TTL (currently ~14 days on testnet, subject to protocol change).

3. **Prefer `Temporary` for short-lived data** — If a value is only needed
   for a bounded window (e.g., a game session nonce, a rate-limit counter),
   store it in temporary storage to reduce long-term rent liability.

4. **Remove entries instead of writing zero** — When a balance reaches zero
   or a flag is no longer needed, call `storage().persistent().remove(&key)`
   rather than writing `0` or `false`. This frees the ledger entry and stops
   future rent accrual. See `tycoon-reward-system` `_burn()` for an example.

5. **Avoid unbounded iteration over storage** — Functions that scan all keys
   of a given prefix (e.g., "all players", "all collectibles of an owner")
   must cap the result set and fail closed if the cap is exceeded. Use
   paginated enumeration (see `tycoon-collectibles` `tokens_of_owner_page`
   and `iterate_owned_tokens`) instead of reading everything at once.

6. **Cap collection sizes** — Enforce a maximum number of entries per user
   (e.g., `MAX_BOOSTS_PER_PLAYER = 10` in `tycoon-boost-system`) to prevent
   storage-bloat attacks. Reject writes that would exceed the cap.

7. **Reject oversized payloads before writing** — Validate input lengths
   (`String`, `Vec`, `Bytes`) against reasonable maxima before storing them.
   A maliciously large metadata string or username could make the entry too
   expensive to keep. See username validation in `tycoon-game`
   (`Username must be 3-20 characters`).

8. **Batch initialization writes** — In `initialize()` functions, write all
   initial state keys in sequence without interleaving reads. This minimizes
   the number of storage round-trips and keeps entry count predictable.

9. **Extend TTLs on hot keys** — Keys that are read frequently but written
   rarely (e.g., shop config, fee config) may need explicit TTL extension
   via `env.storage().instance().extend_ttl(...)`. This is not yet
   implemented across all contracts but should be added for long-lived
   hot paths.

## Storage key design

- Use typed enums with `#[contracttype]` for keys — never raw string keys.
  See `DataKey` enums in `tycoon-token`, `tycoon-game`, and
  `tycoon-reward-system` for the canonical pattern.

- Compound keys (e.g., `Balance(Address, u128)`) should use a single
  `#[contracttype]` enum variant rather than string concatenation.

- Avoid variable-length key components where possible; prefer fixed-size
  types (`Address`, `u32`, `u128`) over `String` keys.

## Rent awareness checklist

- [ ] Instance storage used for config, not per-user data
- [ ] Persistent storage entries removed when value reaches zero
- [ ] Temporary storage considered for ephemeral data
- [ ] No unbounded iteration — paginated views or capped collections
- [ ] Collection size caps enforced (e.g., max boosts per player)
- [ ] Input payload length validation before storage writes
- [ ] Initialization batches all writes together
- [ ] TTL extension considered for hot read-only keys
- [ ] `check-wasm-sizes.sh` budget enforced in CI (see `ci/wasm-size-budget.json`)