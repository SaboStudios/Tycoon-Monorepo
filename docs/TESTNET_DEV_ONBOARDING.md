# Testnet Dev Onboarding — Faucet & Account Strategy

> Issue #416 | Last updated: 2026-03-28

This document explains how developers get XLM on Stellar testnet, the shared dev subaccount policy, and how to reset or wipe contract state.

---

## 1. Getting XLM on Testnet (Friendbot)

Stellar testnet accounts are funded for free via **Friendbot**, which deposits 10,000 XLM.

### Automated (recommended)

Run the provisioning script once per developer:

```bash
cd contract
./scripts/create-dev-subaccounts.sh <your-alias>
# e.g.: ./scripts/create-dev-subaccounts.sh alice
```

This will:
1. Generate a keypair stored in stellar CLI's encrypted local keystore (`~/.config/stellar/identity/`).
2. Fund the account via Friendbot.
3. Print your public key and next steps.

### Manual

```bash
# 1. Generate keypair
stellar keys generate dev-<alias> --network testnet --no-fund

# 2. Get your public key
stellar keys address dev-<alias>

# 3. Fund via Friendbot
curl "https://friendbot.stellar.org?addr=$(stellar keys address dev-<alias>)"
```

> Friendbot works **once per account**. If you need more XLM, create a new account or ask a teammate to send you some from their funded account.

---

## 2. Shared Dev Subaccount Policy

### Rule: one account per developer

Each developer must use their **own** testnet account (`dev-<alias>`). Never share private keys or use a team-wide account for development.

| Do | Don't |
|---|---|
| Deploy your own contract instance | Deploy to the shared staging contract |
| Use `dev-<alias>` for all testnet calls | Use a colleague's key |
| Prefix your contract with your alias (e.g. `tycoon-game-alice.testnet`) | Write game state to the shared contract |
| Delete your contract when done | Leave stale contracts accumulating state |

### Shared staging contract

There is one shared staging contract per environment (see `contract/deploy/deployed-contracts-testnet.txt`). This contract is used for:
- Integration tests in CI
- QA sign-off before mainnet

**Do not call mutating functions on the shared staging contract during development.** Read-only calls (`get_*`, `total_supply`, etc.) are fine.

### Limitations of shared contract state

- All developers share the same ledger entries — a bad `initialize` call or corrupted state affects everyone.
- Stellar testnet is **reset roughly every 3 months** by the Stellar Development Foundation. All accounts and contracts are wiped. Plan accordingly.
- Storage entries have a TTL; entries not extended will expire. The shared contract's TTL is managed by CI (see `contract-build.yml`).

---

## 3. Deploying Your Own Contract Instance

After running `create-dev-subaccounts.sh`:

```bash
# Build contracts
cd contract
make build-wasm

# Deploy your own instance (skip hash check for dev builds)
export DEV_ACCOUNT="$(stellar keys address dev-<alias>)"
./scripts/deploy.sh --network testnet --contract tycoon-game --skip-hash

# Initialize
stellar contract invoke \
  --id <YOUR_CONTRACT_ID> \
  --source dev-<alias> \
  --network testnet \
  -- initialize \
  --tyc_token <TOKEN_ID> \
  --usdc_token <USDC_ID> \
  --initial_owner "$DEV_ACCOUNT" \
  --reward_system <REWARD_ID>
```

Your contract ID is printed by `deploy.sh` and written to `deploy/deployed-contracts-testnet.txt` with your alias prefix.

---

## 4. Reset Procedure

### Reset your own contract

If your contract state is corrupted or you want a clean slate:

```bash
# Option A: Re-deploy (creates a new contract ID)
./scripts/deploy.sh --network testnet --contract tycoon-game --skip-hash

# Option B: If the contract has a reset/clear function (check contract source)
stellar contract invoke \
  --id <YOUR_CONTRACT_ID> \
  --source dev-<alias> \
  --network testnet \
  -- reset_state   # only if implemented
```

### Reset the shared staging contract

Only the **Smart Contract Lead** resets the shared staging contract. Open a GitHub issue tagged `testnet-reset` and assign it to them. Do not attempt to reset it yourself.

### Full testnet reset (SDF-initiated)

The Stellar Development Foundation resets the entire testnet periodically (~every 3 months). When this happens:
1. All accounts and XLM balances are wiped.
2. All deployed contracts are gone.
3. Re-run `create-dev-subaccounts.sh` to get a new funded account.
4. Re-deploy the shared staging contract (CI does this automatically on the next push to `main`).

Watch the [Stellar status page](https://status.stellar.org) and the `#dev` channel for reset announcements.

---

## 5. Avoiding Shared Contract Pollution

- **Never call `initialize` on the shared contract** — it can only be called once and will fail or corrupt state if called again.
- **Never call admin-only mutating functions** (`mint`, `set_admin`, `pause`) on the shared contract unless you are the designated deployer.
- **Use your own contract instance** for any test that writes state.
- If you accidentally pollute the shared contract, immediately notify the Smart Contract Lead.

---

## 6. New Dev Checklist

A new developer can deploy a contract to testnet by following these steps:

- [ ] Install Rust + `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
- [ ] Install stellar CLI: `cargo install stellar-cli --features opt`
- [ ] Verify: `stellar --version` (must be >= 21.0.0)
- [ ] Run: `cd contract && ./scripts/create-dev-subaccounts.sh <your-alias>`
- [ ] Build contracts: `make build-wasm`
- [ ] Deploy your own instance: `./scripts/deploy.sh --network testnet --contract tycoon-game --skip-hash`
- [ ] Verify deployment: `./scripts/verify-deploy.sh --network testnet`
- [ ] Read the [Deployment Runbook](../contract/DEPLOYMENT_RUNBOOK.md) before touching the shared staging contract

---

*For mainnet deployments, see [contract/DEPLOYMENT_RUNBOOK.md](../contract/DEPLOYMENT_RUNBOOK.md).*
