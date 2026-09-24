## WASM size check (budget v2)

Regression threshold: **3%** over committed baseline (deployment cost / rent awareness).

| Contract | Baseline (B) | Current (C) | Δ (C−B) | Max allowed (⌊B×(100+3)/100⌋) | Status |
|----------|-------------:|------------:|--------:|----------------------------------------------:|:-------|
| `tycoon_boost_system.wasm` | 9115 | 9115 | 0 | 9388 | ✅ |
| `tycoon_token.wasm` | 16893 | 16893 | 0 | 17399 | ✅ |
| `tycoon_reward_system.wasm` | 22698 | 22698 | 0 | 23378 | ✅ |
| `tycoon_main_game.wasm` | 23613 | 23613 | 0 | 24321 | ✅ |
| `tycoon_game.wasm` | 26555 | 26555 | 0 | 27351 | ✅ |
| `tycoon_collectibles.wasm` | 31977 | 31977 | 0 | 32936 | ✅ |

