# Security Testing Runbook

## Adversarial contract tests (testnet only)

The script `scripts/adversarial-testnet.sh` calls the deployed Tycoon contracts
on **Stellar Testnet** with malicious patterns and asserts that every call fails
as expected.

> **NEVER run this script with mainnet keys.**
> The script hard-aborts if `STELLAR_NETWORK` is not `testnet`.

### Prerequisites

```bash
# Stellar CLI ≥ 21
stellar --version

# Node.js ≥ 18 (for near-cli-js style JS helpers, optional)
node --version

# Funded testnet account
stellar keys generate adversary --network testnet
stellar keys fund adversary --network testnet
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `STELLAR_NETWORK` | yes | Must be `testnet` |
| `TOKEN_CONTRACT_ID` | yes | Deployed `tycoon-token` contract address |
| `REWARD_CONTRACT_ID` | yes | Deployed `tycoon-reward-system` contract address |
| `GAME_CONTRACT_ID` | yes | Deployed `tycoon-game` contract address |
| `ADVERSARY_KEY` | yes | Stellar CLI key name for the attacker account |
| `ADMIN_KEY` | no | Key name for the admin (needed for setup only) |

### Running

```bash
cd contract
export STELLAR_NETWORK=testnet
export TOKEN_CONTRACT_ID=C...
export REWARD_CONTRACT_ID=C...
export GAME_CONTRACT_ID=C...
export ADVERSARY_KEY=adversary

bash scripts/adversarial-testnet.sh
# Exit 0 = all adversarial cases behaved as expected (all failed correctly).
# Exit 1 = a call that should have failed succeeded — investigate immediately.
```

### Adversarial cases covered

| # | Contract | Pattern | Expected result |
|---|---|---|---|
| 1 | tycoon-token | Mint zero amount | Rejected: "Amount must be positive" |
| 2 | tycoon-token | Mint negative amount | Rejected |
| 3 | tycoon-token | Non-admin mint | Rejected: auth failure |
| 4 | tycoon-token | Transfer more than balance | Rejected: "Insufficient balance" |
| 5 | tycoon-token | transfer_from exceeding allowance | Rejected: "Insufficient allowance" |
| 6 | tycoon-token | Double initialize | Rejected: "Already initialized" |
| 7 | tycoon-token | Repeated rapid mints (10×) | All succeed (no DoS) |
| 8 | tycoon-reward-system | Redeem voucher not owned | Rejected |
| 9 | tycoon-reward-system | Redeem while paused | Rejected |
| 10 | tycoon-reward-system | Non-admin pause | Rejected |
| 11 | tycoon-game | Remove player — wrong predecessor | Rejected: "Unauthorized" |
| 12 | tycoon-game | Withdraw invalid token | Rejected: "Invalid token address" |
| 13 | tycoon-game | Withdraw more than balance | Rejected: "Insufficient contract balance" |

### Interpreting results

Each case prints `[PASS]` when the contract correctly rejected the call, or
`[FAIL]` when a call that should have been rejected succeeded. The script exits
1 on the first `[FAIL]`.

### CI integration

This script is intentionally **not** part of the standard `make ci` target
because it requires live testnet contracts and funded accounts. Run it manually
before a mainnet deployment or as a scheduled nightly job against a staging
deployment.

To add it to a GitHub Actions workflow:

```yaml
- name: Adversarial testnet tests
  env:
    STELLAR_NETWORK: testnet
    TOKEN_CONTRACT_ID: ${{ secrets.TESTNET_TOKEN_CONTRACT_ID }}
    REWARD_CONTRACT_ID: ${{ secrets.TESTNET_REWARD_CONTRACT_ID }}
    GAME_CONTRACT_ID: ${{ secrets.TESTNET_GAME_CONTRACT_ID }}
    ADVERSARY_KEY: adversary
  run: bash contract/scripts/adversarial-testnet.sh
```
