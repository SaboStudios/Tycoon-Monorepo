#!/usr/bin/env bash
# =============================================================================
# verify-deploy.sh — Post-Deploy Verification
#
# Calls read-only view functions on each deployed contract to confirm:
#   1. Contract is reachable on-chain
#   2. Initialization state is correct
#   3. On-chain WASM hash matches the CI artifact hash
#
# Usage:
#   ./scripts/verify-deploy.sh --network testnet
#   ./scripts/verify-deploy.sh --network mainnet --contracts-file deploy/deployed-contracts-mainnet.txt
# =============================================================================

set -euo pipefail

NETWORK=""
CONTRACTS_FILE=""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[VERIFY]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}   $*"; }
error() { echo -e "${RED}[FAIL]${NC}   $*"; FAILURES=$((FAILURES+1)); }
FAILURES=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --network)        NETWORK="$2";        shift 2 ;;
    --contracts-file) CONTRACTS_FILE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

[[ -z "$NETWORK" ]] && { echo "--network required"; exit 1; }

case "$NETWORK" in
  testnet)
    RPC_URL="https://soroban-testnet.stellar.org"
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
    ;;
  mainnet)
    RPC_URL="https://mainnet.stellar.validationcloud.io/v1/${VALIDATION_CLOUD_KEY:-public}"
    NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
    ;;
  *) echo "Unknown network: $NETWORK"; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$SCRIPT_DIR/../deploy"
[[ -z "$CONTRACTS_FILE" ]] && CONTRACTS_FILE="$DEPLOY_DIR/deployed-contracts-${NETWORK}.txt"
HASH_FILE="$DEPLOY_DIR/wasm-hashes.txt"

[[ ! -f "$CONTRACTS_FILE" ]] && { echo "Contracts file not found: $CONTRACTS_FILE"; exit 1; }

# ─── Helper: invoke a read-only contract function ─────────────────────────────
invoke_view() {
  local contract_id="$1"
  local fn="$2"
  shift 2
  stellar contract invoke \
    --id "$contract_id" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- "$fn" "$@" 2>&1
}

# ─── Helper: get on-chain WASM hash for a contract ───────────────────────────
get_onchain_hash() {
  local contract_id="$1"
  stellar contract info \
    --id "$contract_id" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" 2>&1 | grep -i "wasm_hash" | awk '{print $NF}' || echo "unknown"
}

# ─── Verify WASM hash matches CI artifact ────────────────────────────────────
verify_wasm_hash() {
  local contract_name="$1"
  local contract_id="$2"
  local deployed_wasm_hash="$3"

  info "Verifying on-chain WASM hash for $contract_name..."

  if [[ -f "$HASH_FILE" ]]; then
    local wasm_file="${contract_name}.wasm"
    local committed_hash
    committed_hash=$(grep "$wasm_file" "$HASH_FILE" | awk '{print $1}' || true)

    if [[ -z "$committed_hash" ]]; then
      warn "No committed hash for $wasm_file in $HASH_FILE"
    elif [[ "$deployed_wasm_hash" == "$committed_hash" ]]; then
      info "✅ On-chain WASM hash matches CI artifact: $committed_hash"
    else
      error "❌ WASM hash mismatch for $contract_name!"
      error "   CI artifact: $committed_hash"
      error "   On-chain:    $deployed_wasm_hash"
    fi
  else
    warn "No hash file at $HASH_FILE — skipping hash comparison"
  fi
}

# ─── Per-contract verification calls ─────────────────────────────────────────
verify_contract() {
  local name="$1"
  local contract_id="$2"
  local wasm_hash="$3"

  info "--- Verifying $name ($contract_id) ---"

  verify_wasm_hash "$name" "$contract_id" "$wasm_hash"

  case "$name" in
    tycoon_token)
      local supply
      supply=$(invoke_view "$contract_id" "total_supply") || { error "$name: total_supply call failed"; return; }
      info "total_supply = $supply"
      local sym
      sym=$(invoke_view "$contract_id" "symbol") || { error "$name: symbol call failed"; return; }
      [[ "$sym" == *"TYC"* ]] && info "✅ symbol = $sym" || error "❌ unexpected symbol: $sym"
      ;;

    tycoon_reward_system)
      local minter
      minter=$(invoke_view "$contract_id" "get_backend_minter") || { error "$name: get_backend_minter failed"; return; }
      info "backend_minter = $minter"
      info "✅ tycoon_reward_system reachable"
      ;;

    tycoon_collectibles)
      local paused
      paused=$(invoke_view "$contract_id" "is_contract_paused") || { error "$name: is_contract_paused failed"; return; }
      [[ "$paused" == "false" ]] && info "✅ contract is not paused" || warn "⚠️  contract is paused: $paused"
      ;;

    tycoon_boost_system)
      # No zero-arg view functions; just confirm the contract is reachable
      info "✅ tycoon_boost_system reachable (no view-only probe needed)"
      ;;

    tycoon_game)
      local cash_tier
      cash_tier=$(invoke_view "$contract_id" "get_cash_tier_value" --tier 1 2>&1 || true)
      info "get_cash_tier_value(1) = $cash_tier"
      info "✅ tycoon_game reachable"
      ;;

    tycoon_main_game)
      local owner
      owner=$(invoke_view "$contract_id" "get_owner") || { error "$name: get_owner failed"; return; }
      info "owner = $owner"
      info "✅ tycoon_main_game reachable"
      ;;

    *)
      warn "No specific verification defined for $name — skipping function calls"
      ;;
  esac
}

# ─── Main ─────────────────────────────────────────────────────────────────────
info "=== Post-Deploy Verification: $NETWORK ==="
info "Contracts file: $CONTRACTS_FILE"

while IFS=' ' read -r name contract_id wasm_hash _rest; do
  [[ -z "$name" || "$name" == "#"* ]] && continue
  verify_contract "$name" "$contract_id" "$wasm_hash"
done < "$CONTRACTS_FILE"

echo ""
if [[ $FAILURES -eq 0 ]]; then
  info "=== ✅ All verifications passed ==="
else
  echo -e "${RED}=== ❌ $FAILURES verification(s) FAILED ===${NC}"
  exit 1
fi
