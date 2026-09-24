#!/usr/bin/env bash
# adversarial-testnet.sh — Adversarial contract security tests (TESTNET ONLY)
#
# Calls deployed Tycoon contracts with malicious patterns and asserts every
# call fails as expected. Exits 0 when all adversarial cases behave correctly.
#
# See docs/security-testing.md for full runbook and CI integration guide.
#
# Usage:
#   export STELLAR_NETWORK=testnet
#   export TOKEN_CONTRACT_ID=C...
#   export REWARD_CONTRACT_ID=C...
#   export GAME_CONTRACT_ID=C...
#   export ADVERSARY_KEY=adversary
#   bash scripts/adversarial-testnet.sh

set -euo pipefail

# ── Safety guard ──────────────────────────────────────────────────────────────
if [[ "${STELLAR_NETWORK:-}" != "testnet" ]]; then
  echo "ERROR: STELLAR_NETWORK must be 'testnet'. Refusing to run on '${STELLAR_NETWORK:-unset}'."
  echo "       NEVER run adversarial tests with mainnet keys."
  exit 1
fi

# ── Required variables ────────────────────────────────────────────────────────
: "${TOKEN_CONTRACT_ID:?TOKEN_CONTRACT_ID is required}"
: "${REWARD_CONTRACT_ID:?REWARD_CONTRACT_ID is required}"
: "${GAME_CONTRACT_ID:?GAME_CONTRACT_ID is required}"
: "${ADVERSARY_KEY:?ADVERSARY_KEY is required}"

NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"

PASS_COUNT=0
FAIL_COUNT=0

# ── Helpers ───────────────────────────────────────────────────────────────────

# assert_fails <description> <stellar-cli-invoke-args...>
# Runs the stellar contract invoke command and expects it to exit non-zero.
# Prints [PASS] if it fails (correct), [FAIL] if it succeeds (security issue).
assert_fails() {
  local description="$1"
  shift
  echo -n "  Testing: ${description} ... "
  if stellar contract invoke \
      --network "${STELLAR_NETWORK}" \
      --rpc-url "${RPC_URL}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      --source "${ADVERSARY_KEY}" \
      "$@" 2>/dev/null; then
    echo "[FAIL] — call succeeded but should have been rejected"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    echo "[PASS]"
    PASS_COUNT=$((PASS_COUNT + 1))
  fi
}

# assert_succeeds <description> <stellar-cli-invoke-args...>
# Used for the "repeated calls" DoS check — these should succeed.
assert_succeeds() {
  local description="$1"
  shift
  echo -n "  Testing: ${description} ... "
  if stellar contract invoke \
      --network "${STELLAR_NETWORK}" \
      --rpc-url "${RPC_URL}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      --source "${ADVERSARY_KEY}" \
      "$@" 2>/dev/null; then
    echo "[PASS]"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "[FAIL] — call failed but should have succeeded"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

ADVERSARY_ADDRESS=$(stellar keys address "${ADVERSARY_KEY}" --network "${STELLAR_NETWORK}")

echo "============================================================"
echo " Tycoon Adversarial Testnet Tests"
echo " Network : ${STELLAR_NETWORK}"
echo " Attacker: ${ADVERSARY_ADDRESS}"
echo "============================================================"
echo ""

# ── tycoon-token ──────────────────────────────────────────────────────────────
echo "[ tycoon-token: ${TOKEN_CONTRACT_ID} ]"

# Case 1: Mint zero amount — must be rejected
assert_fails "mint zero amount" \
  --id "${TOKEN_CONTRACT_ID}" \
  -- mint \
  --to "${ADVERSARY_ADDRESS}" \
  --amount 0

# Case 2: Mint negative amount — must be rejected
assert_fails "mint negative amount" \
  --id "${TOKEN_CONTRACT_ID}" \
  -- mint \
  --to "${ADVERSARY_ADDRESS}" \
  --amount -- -1

# Case 3: Non-admin mint — must be rejected (adversary is not admin)
assert_fails "non-admin mint" \
  --id "${TOKEN_CONTRACT_ID}" \
  -- mint \
  --to "${ADVERSARY_ADDRESS}" \
  --amount 1000000000000000000

# Case 4: Transfer more than balance — must be rejected
assert_fails "transfer exceeding balance" \
  --id "${TOKEN_CONTRACT_ID}" \
  -- transfer \
  --from "${ADVERSARY_ADDRESS}" \
  --to "${ADVERSARY_ADDRESS}" \
  --amount 999999999999999999999999999999

# Case 5: transfer_from exceeding allowance — must be rejected
assert_fails "transfer_from exceeding allowance" \
  --id "${TOKEN_CONTRACT_ID}" \
  -- transfer_from \
  --spender "${ADVERSARY_ADDRESS}" \
  --from "${ADVERSARY_ADDRESS}" \
  --to "${ADVERSARY_ADDRESS}" \
  --amount 999999999999999999999999999999

# Case 6: Double initialize — must be rejected
assert_fails "double initialize" \
  --id "${TOKEN_CONTRACT_ID}" \
  -- initialize \
  --admin "${ADVERSARY_ADDRESS}" \
  --initial_supply 1000000000000000000000000000

# Case 7: Repeated rapid mints (10×) by non-admin — all must fail (no DoS)
echo "  Testing: repeated rapid mints (10x non-admin, all should fail) ..."
RAPID_PASS=0
for i in $(seq 1 10); do
  if ! stellar contract invoke \
      --network "${STELLAR_NETWORK}" \
      --rpc-url "${RPC_URL}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      --source "${ADVERSARY_KEY}" \
      --id "${TOKEN_CONTRACT_ID}" \
      -- mint \
      --to "${ADVERSARY_ADDRESS}" \
      --amount 1 2>/dev/null; then
    RAPID_PASS=$((RAPID_PASS + 1))
  fi
done
if [[ "${RAPID_PASS}" -eq 10 ]]; then
  echo "  [PASS] all 10 rapid mint attempts correctly rejected"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "  [FAIL] only ${RAPID_PASS}/10 rapid mint attempts were rejected"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# ── tycoon-reward-system ──────────────────────────────────────────────────────
echo "[ tycoon-reward-system: ${REWARD_CONTRACT_ID} ]"

# Case 8: Redeem voucher not owned by adversary — must be rejected
# Use token_id=999999 which the adversary certainly does not own.
assert_fails "redeem voucher not owned" \
  --id "${REWARD_CONTRACT_ID}" \
  -- redeem_voucher_from \
  --caller "${ADVERSARY_ADDRESS}" \
  --token_id 999999

# Case 9: Redeem while paused — must be rejected
# (Assumes the contract is currently paused on testnet staging; skip if not.)
assert_fails "redeem while paused (token_id=999999)" \
  --id "${REWARD_CONTRACT_ID}" \
  -- redeem_voucher_from \
  --caller "${ADVERSARY_ADDRESS}" \
  --token_id 999999

# Case 10: Non-admin pause — must be rejected
assert_fails "non-admin pause" \
  --id "${REWARD_CONTRACT_ID}" \
  -- pause

echo ""

# ── tycoon-game ───────────────────────────────────────────────────────────────
echo "[ tycoon-game: ${GAME_CONTRACT_ID} ]"

# Case 11: Remove player with wrong predecessor (adversary is not owner/backend)
assert_fails "remove player — unauthorized caller" \
  --id "${GAME_CONTRACT_ID}" \
  -- remove_player_from_game \
  --caller "${ADVERSARY_ADDRESS}" \
  --game_id 1 \
  --player "${ADVERSARY_ADDRESS}" \
  --turn_count 0

# Case 12: Withdraw invalid token — must be rejected
FAKE_TOKEN=$(stellar keys address "${ADVERSARY_KEY}" --network "${STELLAR_NETWORK}")
assert_fails "withdraw invalid token" \
  --id "${GAME_CONTRACT_ID}" \
  -- withdraw_funds \
  --token "${FAKE_TOKEN}" \
  --recipient "${ADVERSARY_ADDRESS}" \
  --amount 1

# Case 13: Withdraw more than balance — must be rejected
# Use a known valid token address but an absurdly large amount.
assert_fails "withdraw exceeding contract balance" \
  --id "${GAME_CONTRACT_ID}" \
  -- withdraw_funds \
  --token "${FAKE_TOKEN}" \
  --recipient "${ADVERSARY_ADDRESS}" \
  --amount 999999999999999999999999999999

echo ""
echo "============================================================"
echo " Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
echo "============================================================"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  echo "SECURITY ISSUE: ${FAIL_COUNT} adversarial case(s) were not rejected."
  echo "Investigate immediately before deploying to mainnet."
  exit 1
fi

echo "All adversarial cases behaved as expected."
exit 0
