# tycoon-lib

Shared Rust library for the Tycoon contracts. It holds the pure, chain-agnostic
logic that the game, reward, and fee contracts reuse.

## Modules

- `fees` — fee splitting for sales (`FeeSplit`, `calculate_fee_split`).

## Fee residue

`calculate_fee_split` splits an `amount` into `platform_amount`, `creator_amount`,
`pool_amount`, and `residue`. The `residue` is the rounding dust left over after
the three basis-point shares are computed.

**The residue is paid to the creator.** Callers must not transfer only the three
named amounts (that underpays the sale and leaves the dust with the payer), and
must not transfer the full `amount` on top of the split (that overpays).

To make this impossible to forget, use `creator_total(&split)`, which returns
`creator_amount + residue`. Paying `platform_amount`, `pool_amount`, and
`creator_total` together always sums to the original `amount` with no leftover.

Example: a 100-unit sale at 3333 basis points yields a residue of 1, and
`creator_total` includes it.
