# Tycoon Contract Deployment Runbook

**Applies to:** All Soroban contracts in `contract/contracts/`  
**Last updated:** See git log  
**Acceptance criteria:** Dry run on testnet completed with the same script before any mainnet deployment.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Hardware Wallet Setup (Ledger)](#2-hardware-wallet-setup-ledger)
3. [Multisig Setup](#3-multisig-setup)
4. [Step-by-Step Deployment](#4-step-by-step-deployment)
5. [WASM Hash Verification](#5-wasm-hash-verification)
6. [Post-Deploy Verification Calls](#6-post-deploy-verification-calls)
7. [Contract Initialization](#7-contract-initialization)
8. [Testnet Dry Run Checklist](#8-testnet-dry-run-checklist)
9. [Incident Contacts](#9-incident-contacts)
10. [No Private Keys Policy](#10-no-private-keys-policy)

---

## 1. Prerequisites

Install the following before any deployment:

```bash
# Stellar CLI (required)
cargo install --locked stellar-cli --features opt

# Verify
stellar --version   # must be >= 21.0.0
```

Required environment variables (export before running any script — **never commit these**):

```bash
export DEPLOYER_ACCOUNT="G..."          # Public key of the deployer (hardware wallet address)
export EXPECTED_HASH="<sha256>"         # Copy from CI artifact wasm-hashes.txt for the target contract
# Mainnet only:
export VALIDATION_CLOUD_KEY="<key>"     # RPC provider key (store in password manager, not shell history)
```

---

## 2. Hardware Wallet Setup (Ledger)

Tycoon uses a Ledger hardware wallet for all mainnet deployments. The private key **never leaves the device**.

### 2.1 One-time setup

1. Install the **Stellar app** on your Ledger (Ledger Live → My Ledger → search "Stellar").
2. Enable **blind signing** in the Stellar app settings (required for Soroban contract transactions).
3. Connect the Ledger via USB. Unlock it and open the Stellar app.
4. Add the Ledger account to stellar CLI:

```bash
stellar keys add ledger-deployer --ledger
# stellar CLI will detect the Ledger and display the public key.
# Confirm the address matches your expected deployer address.
```

5. Export the public key for use as `DEPLOYER_ACCOUNT`:

```bash
stellar keys address ledger-deployer
# Copy the output → export DEPLOYER_ACCOUNT="G..."
```

### 2.2 Per-deployment

1. Connect Ledger, unlock, open Stellar app.
2. Run the deploy script (see §4). When prompted, **review the transaction on the Ledger screen** before approving.
3. The Ledger screen will show: fee, source account, contract WASM hash. Verify these match what you expect.
4. Press both buttons to approve. The CLI submits the signed transaction.

> ⚠️ **Never approve a transaction on the Ledger without reading the screen.** If the WASM hash shown on the device does not match the CI artifact hash, reject and investigate.

---

## 3. Multisig Setup

For mainnet deployments requiring 2-of-3 multisig:

### 3.1 Configure multisig on the deployer account

```bash
# Add co-signers (run once, signed by the current sole signer)
stellar tx new set-options \
  --source "$DEPLOYER_ACCOUNT" \
  --network mainnet \
  --signer-key "G<COSIGNER_1_PUBKEY>" --signer-weight 1 \
  --signer-key "G<COSIGNER_2_PUBKEY>" --signer-weight 1 \
  --signer-key "G<COSIGNER_3_PUBKEY>" --signer-weight 1 \
  --low-threshold 2 \
  --med-threshold 2 \
  --high-threshold 2
```

### 3.2 Multisig deployment flow

1. **Proposer** builds and signs the transaction (does not submit):

```bash
stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/tycoon_token.wasm \
  --source "$DEPLOYER_ACCOUNT" \
  --rpc-url https://mainnet.stellar.validationcloud.io/v1/$VALIDATION_CLOUD_KEY \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  --build-only \
  > /tmp/unsigned-tx.xdr
```

2. **Proposer** shares `unsigned-tx.xdr` with co-signers via a secure channel (Signal, encrypted email).

3. **Each co-signer** reviews and signs:

```bash
stellar tx sign /tmp/unsigned-tx.xdr \
  --sign-with-ledger \
  --network mainnet
```

4. **Proposer** combines signatures and submits:

```bash
stellar tx submit /tmp/signed-tx.xdr --network mainnet
```

---

## 4. Step-by-Step Deployment

### 4.1 Build contracts from source

Always build from the **exact commit** that produced the CI artifact you are deploying.

```bash
git checkout <COMMIT_SHA>
cd contract
cargo build --target wasm32-unknown-unknown --release
```

### 4.2 Download CI artifact and verify hash

1. Go to the GitHub Actions run for `<COMMIT_SHA>`.
2. Download the `wasm-artifacts-<COMMIT_SHA>` artifact.
3. Open `wasm-hashes.txt` and copy the hash for the contract you are deploying.
4. Export it:

```bash
export EXPECTED_HASH="<hash from wasm-hashes.txt>"
```

### 4.3 Testnet dry run (mandatory before mainnet)

```bash
cd contract
export DEPLOYER_ACCOUNT="G..."
export EXPECTED_HASH="<hash>"

# Dry run — no transactions submitted
./scripts/deploy.sh --network testnet --contract tycoon-token --dry-run

# Real testnet deploy
./scripts/deploy.sh --network testnet --contract tycoon-token
```

### 4.4 Verify testnet deployment

```bash
./scripts/verify-deploy.sh --network testnet
```

All checks must pass before proceeding to mainnet.

### 4.5 Mainnet deployment

```bash
./scripts/deploy.sh --network mainnet --contract tycoon-token
# Script will prompt: type 'deploy mainnet' to confirm
```

Repeat for each contract in dependency order:

```
1. tycoon-token
2. tycoon-reward-system
3. tycoon-collectibles
4. tycoon-boost-system
5. tycoon-game
6. tycoon-main-game
```

### 4.6 Verify mainnet deployment

```bash
./scripts/verify-deploy.sh --network mainnet
```

---

## 5. WASM Hash Verification

Every deployment **must** verify the WASM hash before submitting any transaction.

### How it works

1. CI builds all contracts on every push to `main`/`contract` branches.
2. CI computes `sha256sum` of each `.wasm` file and writes `deploy/wasm-hashes.txt`.
3. The file and all WASM artifacts are uploaded as a GitHub Actions artifact (`wasm-artifacts-<sha>`).
4. The deployer downloads the artifact, copies the hash into `EXPECTED_HASH`, and the deploy script verifies the local WASM matches before uploading.

### Manual verification

```bash
# Compute hash of your local build
sha256sum target/wasm32-unknown-unknown/release/tycoon_token.wasm

# Compare against CI artifact
cat deploy/wasm-hashes.txt | grep tycoon_token
```

If they differ: **do not deploy**. Rebuild from the exact commit that produced the CI artifact.

### On-chain hash verification

After deployment, confirm the on-chain WASM hash matches:

```bash
stellar contract info \
  --id <CONTRACT_ID> \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
# Look for wasm_hash in the output
```

---

## 6. Post-Deploy Verification Calls

Run immediately after every deployment:

```bash
./scripts/verify-deploy.sh --network <testnet|mainnet>
```

The script calls the following read-only functions per contract:

| Contract | Function | Expected result |
|---|---|---|
| `tycoon_token` | `total_supply` | > 0 after initialization |
| `tycoon_token` | `symbol` | `"TYC"` |
| `tycoon_reward_system` | `get_backend_minter` | `None` or configured address |
| `tycoon_collectibles` | `is_contract_paused` | `false` |
| `tycoon_game` | `get_cash_tier_value(1)` | configured value or error |
| `tycoon_main_game` | `get_owner` | deployer address |

Any failure exits with code 1 and prints a summary. **Do not proceed with initialization if verification fails.**

---

## 7. Contract Initialization

After deployment, each contract must be initialized. These calls require the deployer's signature.

```bash
# tycoon-token
stellar contract invoke \
  --id <TYCOON_TOKEN_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network testnet \
  -- initialize \
  --admin "$DEPLOYER_ACCOUNT" \
  --initial_supply 1000000000000

# tycoon-reward-system
stellar contract invoke \
  --id <REWARD_SYSTEM_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network testnet \
  -- initialize \
  --admin "$DEPLOYER_ACCOUNT" \
  --tyc_token <TYCOON_TOKEN_ID> \
  --usdc_token <USDC_TOKEN_ID>

# tycoon-collectibles
stellar contract invoke \
  --id <COLLECTIBLES_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network testnet \
  -- initialize \
  --admin "$DEPLOYER_ACCOUNT"

stellar contract invoke \
  --id <COLLECTIBLES_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network testnet \
  -- init_shop \
  --tyc_token <TYCOON_TOKEN_ID> \
  --usdc_token <USDC_TOKEN_ID>

# tycoon-game
stellar contract invoke \
  --id <GAME_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network testnet \
  -- initialize \
  --tyc_token <TYCOON_TOKEN_ID> \
  --usdc_token <USDC_TOKEN_ID> \
  --initial_owner "$DEPLOYER_ACCOUNT" \
  --reward_system <REWARD_SYSTEM_ID>

# tycoon-main-game
stellar contract invoke \
  --id <MAIN_GAME_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network testnet \
  -- initialize \
  --owner "$DEPLOYER_ACCOUNT" \
  --reward_system <REWARD_SYSTEM_ID> \
  --usdc_token <USDC_TOKEN_ID>
```

---

## 8. Testnet Dry Run Checklist

Complete this checklist and attach the output to the deployment PR before any mainnet deployment.

```
[ ] 1. Checked out exact commit SHA that produced the CI artifact
[ ] 2. Downloaded wasm-artifacts-<sha> from GitHub Actions
[ ] 3. Exported EXPECTED_HASH for each contract
[ ] 4. Ran: ./scripts/deploy.sh --network testnet --contract all --dry-run
        Output shows no errors
[ ] 5. Ran: ./scripts/deploy.sh --network testnet --contract all
        All contracts deployed successfully
[ ] 6. Ran: ./scripts/verify-deploy.sh --network testnet
        Output: "All verifications passed"
[ ] 7. Ran initialization calls (§7) on testnet
[ ] 8. Ran verify-deploy.sh again after initialization — all checks pass
[ ] 9. Reviewed deploy/deploy-*.log — no unexpected warnings
[ ] 10. deploy/deployed-contracts-testnet.txt updated with contract IDs
[ ] 11. Tech lead has reviewed and signed off on this checklist
[ ] 12. Incident contacts (§9) are aware of the upcoming mainnet deployment
```

---

## 9. Incident Contacts

In the event of a deployment failure, unexpected contract behaviour, or security incident:

| Role | Contact | Availability |
|---|---|---|
| Smart Contract Lead | `@<handle>` on Telegram/Signal | Primary — 24/7 for P0 |
| Tech Lead | `@<handle>` on Telegram/Signal | Primary — business hours |
| Security Reviewer | `@<handle>` on Telegram/Signal | On-call for security incidents |
| Stellar Foundation Support | https://discord.gg/stellardev | Community support |

### Incident response steps

1. **Pause affected contracts immediately** (if pause function is available):

```bash
stellar contract invoke --id <CONTRACT_ID> --source "$DEPLOYER_ACCOUNT" \
  --network mainnet -- pause
```

2. Open a **private** GitHub issue tagged `incident` and `P0`.
3. Notify all contacts in the table above.
4. Do **not** post contract IDs, transaction hashes, or exploit details publicly until the incident is resolved.
5. After resolution, publish a post-mortem within 72 hours.

---

## 10. No Private Keys Policy

**Private keys must never appear in:**
- CI environment variables (use `DEPLOYER_ACCOUNT` public key only)
- Shell history (`export` with a space prefix, or use a secrets manager)
- Git commits, PRs, or issues
- Slack, Discord, or any chat platform
- Log files (the deploy script logs are safe — they only record public keys and contract IDs)

**Approved signing methods:**
- Ledger hardware wallet via `stellar keys add --ledger`
- Multisig via `stellar tx sign` with individual Ledger devices
- Stellar CLI secure keystore (`stellar keys add <name>` — keys stored encrypted at `~/.config/stellar/identity/`)

**If a private key is ever exposed:**
1. Immediately rotate the key (create a new account, transfer ownership).
2. Notify the Smart Contract Lead and Security Reviewer.
3. Audit all transactions from the compromised account.
