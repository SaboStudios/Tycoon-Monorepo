# Treasury Balance Sheet Invariant

## Statement
For every state snapshot S:

    Σ balances(S) + escrow(S) = liabilities(S) + treasury(S)

## Definitions
- **balances**: sum of all player/account token balances tracked on-chain.
- **escrow**: tokens locked pending settlement (bets, auctions, etc.).
- **liabilities**: obligations owed to players (pending withdrawals, prizes).
- **treasury**: protocol-owned reserve.

## Proof Sketch
1. Total supply T is fixed at mint time (or updated only via guarded mint/burn).
2. Every user-facing operation is a zero-sum transfer between exactly two of
   {balances, escrow, liabilities, treasury}.
3. Therefore the invariant is preserved inductively:
   - Base case: at genesis, all four terms are defined so the equation holds.
   - Inductive step: each operation adds +x to one term and -x to another,
     leaving the sum unchanged.
4. QED.

## Drift Detection (optional)
A scheduled job may snapshot all four accumulators and alert if the delta
exceeds a configurable epsilon (recommended: 0 for integer arithmetic).
