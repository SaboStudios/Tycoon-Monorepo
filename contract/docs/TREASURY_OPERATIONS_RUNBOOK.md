# Treasury Operations Runbook — Mainnet

**Scope:** `withdraw_funds` on `tycoon-reward-system` and `tycoon-game` contracts.  
**Prerequisite:** Complete the [Deployment Runbook](../DEPLOYMENT_RUNBOOK.md) before any treasury operation.

---

## 1. Who Can Withdraw What

| Contract | Authorized Caller | Allowed Tokens | Function |
|---|---|---|---|
| `tycoon-reward-system` | Admin (set at `initialize`) | TYC, USDC | `withdraw_funds(token, to, amount)` |
| `tycoon-game` | Owner (set at `initialize`) | TYC, USDC | `withdraw_funds(token, to, amount)` |

Any other token address panics with `"Invalid token: not in allowlist"` (reward-system) or `"Invalid token address"` (game). Any other caller's auth fails at the Soroban level.

---

## 2. Daily Limit Policy

No on-chain daily limit is enforced. Operational controls apply instead:

- Single withdrawal ≤ 10 % of contract balance requires Smart Contract Lead approval.
- Single withdrawal > 10 % requires Tech Lead co-sign (multisig, see §3).
- All withdrawals must be logged in the treasury ledger (see §5).

---

## 3. Pre-Withdrawal Checklist

```
[ ] 1. Confirm contract ID from deploy/deployed-contracts-mainnet.txt
[ ] 2. Confirm token address (TYC or USDC) from the same file
[ ] 3. Confirm recipient address with the requestor out-of-band (Signal/encrypted email)
[ ] 4. Check contract balance (see §4.1) — amount must not exceed balance
[ ] 5. For amounts > 10 % of balance: obtain Tech Lead co-sign on the XDR
[ ] 6. Record planned withdrawal in treasury ledger before submitting
```

---

## 4. Step-by-Step Withdrawal

### 4.1 Check contract balance

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network mainnet \
  -- get_balance \
  --owner <CONTRACT_ID> \
  --token_id 0
```

For raw token balance use the token contract directly:

```bash
stellar contract invoke \
  --id <TYC_TOKEN_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network mainnet \
  -- balance \
  --id <CONTRACT_ID>
```

### 4.2 Submit withdrawal (Ledger required)

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source ledger-deployer \
  --network mainnet \
  -- withdraw_funds \
  --token <TYC_TOKEN_ID_OR_USDC_TOKEN_ID> \
  --to <RECIPIENT_ADDRESS> \
  --amount <AMOUNT_IN_STROOPS>
```

The Ledger screen will show the contract ID, function name, and fee. Verify before approving.

### 4.3 Verify on-chain

```bash
# Confirm recipient received funds
stellar contract invoke \
  --id <TOKEN_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network mainnet \
  -- balance \
  --id <RECIPIENT_ADDRESS>

# Confirm contract balance decreased
stellar contract invoke \
  --id <TOKEN_ID> \
  --source "$DEPLOYER_ACCOUNT" \
  --network mainnet \
  -- balance \
  --id <CONTRACT_ID>
```

### 4.4 Verify FundsWithdrawn event

```bash
stellar events \
  --network mainnet \
  --contract-id <CONTRACT_ID> \
  --topic1 "FundsWithdrawn" \
  --count 5
```

Expected output includes: topic `FundsWithdrawn`, token address, recipient address, and amount as event data.

---

## 5. Treasury Ledger Entry

After every withdrawal, append one line to `deploy/treasury-ledger-mainnet.csv`:

```
date_utc,contract_id,token,recipient,amount_stroops,tx_hash,approved_by
2026-01-15T14:32:00Z,C...,TYC,G...,500000000000,a1b2c3...,@smartcontract-lead
```

Commit this file to the repo in a PR titled `treasury: withdraw <amount> <token> <date>`.

---

## 6. Error Reference

| Panic message | Cause | Resolution |
|---|---|---|
| `"Insufficient contract balance"` | `amount > contract balance` | Reduce amount or fund contract first |
| `"Invalid token: not in allowlist"` | Token not TYC or USDC (reward-system) | Use correct token address |
| `"Invalid token address"` | Token not TYC or USDC (game) | Use correct token address |
| `"Not initialized"` | Contract not initialized | Run `initialize` first |
| Auth error (Soroban) | Caller is not admin/owner | Use the correct Ledger account |
| `"Contract is paused"` | Contract paused | Unpause before withdrawing |

---

## 7. Emergency: Drain Before Upgrade

If a vulnerability is found and the contract must be drained before an upgrade:

1. Pause the contract immediately:

```bash
stellar contract invoke --id <CONTRACT_ID> --source ledger-deployer \
  --network mainnet -- pause
```

2. Withdraw full TYC balance to a cold wallet:

```bash
stellar contract invoke --id <CONTRACT_ID> --source ledger-deployer \
  --network mainnet -- withdraw_funds \
  --token <TYC_TOKEN_ID> --to <COLD_WALLET> --amount <FULL_BALANCE>
```

3. Withdraw full USDC balance:

```bash
stellar contract invoke --id <CONTRACT_ID> --source ledger-deployer \
  --network mainnet -- withdraw_funds \
  --token <USDC_TOKEN_ID> --to <COLD_WALLET> --amount <FULL_BALANCE>
```

4. Notify incident contacts (see Deployment Runbook §9).
5. Do not unpause until the patched contract is deployed and verified.

---

## 8. Token Address Reference

Fill in after mainnet deployment:

| Token | Symbol | Contract ID |
|---|---|---|
| Tycoon Token | TYC | *(from `deploy/deployed-contracts-mainnet.txt`)* |
| USD Coin | USDC | *(from `deploy/deployed-contracts-mainnet.txt`)* |
| Reward System | — | *(from `deploy/deployed-contracts-mainnet.txt`)* |
| Game Contract | — | *(from `deploy/deployed-contracts-mainnet.txt`)* |
