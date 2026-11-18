# Tycoon Reward System

Soroban smart contract for the Tycoon reward system. It mints, transfers, and redeems reward vouchers, and tracks collectible perks and strengths.

## Event topic symbols

Reward events are published with a topic symbol. Most use `symbol_short!`, which accepts **at most nine characters**. A longer topic must use `Symbol::new` instead — but note that switching an event to `Symbol::new` changes the topic encoding, so indexers that match on the short form will miss it. Keep the symbols below exactly as they appear in `src/lib.rs`.

| Event | Topic symbol | Form |
| --- | --- | --- |
| Pause | `Paused` | `symbol_short!` |
| Unpause | `Unpaused` | `symbol_short!` |
| Set backend minter | `set_min` | `symbol_short!` |
| Clear backend minter | `clr_min` | `symbol_short!` |
| Mint voucher | `V_Mint` | `symbol_short!` |
| Redeem voucher | `Redeem` | `symbol_short!` |
| Transfer | `Transfer` | `symbol_short!` |
| Mint | `Mint` | `symbol_short!` |
| Burn | `Burn` | `symbol_short!` |
| Withdraw funds | `FundsWithdrawn` | `Symbol::new` (long symbol, > 9 chars) |

`FundsWithdrawn` is longer than nine characters, so `withdraw_funds` uses `Symbol::new` rather than `symbol_short!`.
