# NEAR wallet error utilities

This module provides centralized NEAR wallet and transaction error handling for the Tycoon frontend.

## Public API

- `NEAR_SIGNATURE_REJECTED_MESSAGE` — consistent user-facing message for wallet rejects.
- `isLikelyUserRejectedError(error)` — detects rejection patterns across error shapes.
- `nearErrorMessage(error)` — maps NEAR wallet and RPC failures to friendly text.

## Behavior

- Nested error objects are supported through `message`, `error`, and `cause` chains.
- Common NEAR wallet conditions such as disconnected wallets, invalid account IDs, and network failures are mapped to stable UI messages.
- Unknown or empty errors fall back to a safe generic NEAR wallet request message.
