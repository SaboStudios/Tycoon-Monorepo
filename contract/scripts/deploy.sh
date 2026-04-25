#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Tycoon Contract Deployment Script
#
# Usage:
#   ./scripts/deploy.sh --network testnet --contract tycoon-token
#   ./scripts/deploy.sh --network mainnet --contract all --dry-run
#
# Requirements:
#   - stellar CLI installed (https://developers.stellar.org/docs/tools/stellar-cli)
#   - Hardware wallet connected (Ledger) OR multisig key file path set
#   - DEPLOYER_ACCOUNT env var set to the signing account address
#   - EXPECTED_HASH env var set (copy from CI artifact wasm-hashes.txt)
#
# NO PRIVATE KEYS are read or stored by this script.
# Signing is delegated to the hardware wallet or stellar-cli's secure keystore.
# =============================================================================

set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────────────────────
NETWORK=""
CONTRACT=""
DRY_RUN=false
SKIP_HASH_CHECK=false
WASM_DIR="$(cd "$(dirname "$0")/.." && pwd)/target/wasm32-unknown-unknown/release"
HASH_FILE="$(cd "$(dirname "$0")/.." && pwd)/deploy/wasm-hashes.txt"
LOG_FILE="$(cd "$(dirname "$0")/.." && pwd)/deploy/deploy-$(date +%Y%m%d-%H%M%S).log"

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*" | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"; exit 1; }
dryrun()  { echo -e "${YELLOW}[DRY-RUN]${NC} Would run: $*" | tee -a "$LOG_FILE"; }

# ─── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --network)    NETWORK="$2";    shift 2 ;;
    --contract)   CONTRACT="$2";   shift 2 ;;
    --dry-run)    DRY_RUN=true;    shift   ;;
    --skip-hash)  SKIP_HASH_CHECK=true; shift ;;
    *) error "Unknown argument: $1" ;;
  esac
done

[[ -z "$NETWORK" ]]   && error "--network is required (testnet|mainnet)"
[[ -z "$CONTRACT" ]]  && error "--contract is required (e.g. tycoon-token, all)"
[[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]] && \
  error "--network must be 'testnet' or 'mainnet'"

mkdir -p "$(dirname "$LOG_FILE")"
info "Deploy log: $LOG_FILE"

# ─── Pre-flight checks ────────────────────────────────────────────────────────
info "=== Pre-flight checks ==="

command -v stellar &>/dev/null || error "stellar CLI not found. Install: cargo install stellar-cli --features opt"
command -v sha256sum &>/dev/null || command -v shasum &>/dev/null || \
  error "sha256sum / shasum not found"

[[ -z "${DEPLOYER_ACCOUNT:-}" ]] && \
  error "DEPLOYER_ACCOUNT env var not set. Export the deployer's public key address."

info "Network:          $NETWORK"
info "Contract:         $CONTRACT"
info "Deployer account: $DEPLOYER_ACCOUNT"
info "Dry run:          $DRY_RUN"

# ─── Network RPC endpoints ────────────────────────────────────────────────────
case "$NETWORK" in
  testnet)
    RPC_URL="https://soroban-testnet.stellar.org"
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
    ;;
  mainnet)
    RPC_URL="https://mainnet.stellar.validationcloud.io/v1/${VALIDATION_CLOUD_KEY:-public}"
    NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
    warn "MAINNET deployment — double-check everything before proceeding."
    if [[ "$DRY_RUN" == "false" ]]; then
      read -rp "Type 'deploy mainnet' to confirm: " CONFIRM
      [[ "$CONFIRM" != "deploy mainnet" ]] && error "Aborted by user."
    fi
    ;;
esac

# ─── WASM hash verification ───────────────────────────────────────────────────
verify_hash() {
  local wasm_file="$1"
  local wasm_name
  wasm_name=$(basename "$wasm_file")

  if [[ "$SKIP_HASH_CHECK" == "true" ]]; then
    warn "Hash check skipped (--skip-hash). NOT recommended for mainnet."
    return 0
  fi

  info "=== WASM Hash Verification ==="

  # Compute actual hash
  if command -v sha256sum &>/dev/null; then
    ACTUAL_HASH=$(sha256sum "$wasm_file" | awk '{print $1}')
  else
    ACTUAL_HASH=$(shasum -a 256 "$wasm_file" | awk '{print $1}')
  fi
  info "Actual hash:   $ACTUAL_HASH  ($wasm_name)"

  # Check against EXPECTED_HASH env var (set by deployer from CI artifact)
  if [[ -n "${EXPECTED_HASH:-}" ]]; then
    if [[ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]]; then
      error "HASH MISMATCH for $wasm_name!\n  Expected: $EXPECTED_HASH\n  Actual:   $ACTUAL_HASH\n\nDo NOT deploy. Download the correct artifact from CI."
    fi
    info "✅ Hash matches EXPECTED_HASH."
    return 0
  fi

  # Fallback: check against committed wasm-hashes.txt
  if [[ -f "$HASH_FILE" ]]; then
    COMMITTED_HASH=$(grep "$wasm_name" "$HASH_FILE" | awk '{print $1}' || true)
    if [[ -z "$COMMITTED_HASH" ]]; then
      warn "No committed hash found for $wasm_name in $HASH_FILE."
      warn "Set EXPECTED_HASH env var to the hash from the CI artifact."
    elif [[ "$ACTUAL_HASH" != "$COMMITTED_HASH" ]]; then
      error "HASH MISMATCH for $wasm_name!\n  Committed: $COMMITTED_HASH\n  Actual:    $ACTUAL_HASH\n\nRebuild from the exact CI commit or set EXPECTED_HASH."
    else
      info "✅ Hash matches committed baseline."
    fi
  else
    warn "No hash file at $HASH_FILE. Set EXPECTED_HASH env var."
  fi
}

# ─── Deploy a single contract ─────────────────────────────────────────────────
deploy_contract() {
  local name="$1"          # e.g. tycoon_token
  local wasm_file="$WASM_DIR/${name}.wasm"

  [[ ! -f "$wasm_file" ]] && error "WASM not found: $wasm_file\nRun: cargo build --target wasm32-unknown-unknown --release"

  verify_hash "$wasm_file"

  info "=== Deploying $name to $NETWORK ==="

  # Install WASM (upload bytecode, get wasm_hash)
  # Signing is done by stellar CLI using the hardware wallet or secure keystore.
  # The --source flag references the account by address; stellar CLI prompts
  # the hardware wallet for the actual signature — no private key is passed here.
  local INSTALL_CMD=(
    stellar contract install
    --wasm "$wasm_file"
    --source "$DEPLOYER_ACCOUNT"
    --rpc-url "$RPC_URL"
    --network-passphrase "$NETWORK_PASSPHRASE"
  )

  if [[ "$DRY_RUN" == "true" ]]; then
    dryrun "${INSTALL_CMD[*]}"
    WASM_HASH="<dry-run-hash>"
  else
    info "Installing WASM bytecode (hardware wallet will prompt for signature)..."
    WASM_HASH=$(${INSTALL_CMD[@]} 2>&1 | tee -a "$LOG_FILE" | tail -1)
    info "Installed WASM hash: $WASM_HASH"
  fi

  # Deploy contract instance
  local DEPLOY_CMD=(
    stellar contract deploy
    --wasm-hash "$WASM_HASH"
    --source "$DEPLOYER_ACCOUNT"
    --rpc-url "$RPC_URL"
    --network-passphrase "$NETWORK_PASSPHRASE"
  )

  if [[ "$DRY_RUN" == "true" ]]; then
    dryrun "${DEPLOY_CMD[*]}"
    CONTRACT_ID="<dry-run-contract-id>"
  else
    info "Deploying contract instance (hardware wallet will prompt for signature)..."
    CONTRACT_ID=$(${DEPLOY_CMD[@]} 2>&1 | tee -a "$LOG_FILE" | tail -1)
    info "Contract deployed: $CONTRACT_ID"
  fi

  # Record deployment
  echo "$name $CONTRACT_ID $WASM_HASH $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    >> "$(dirname "$LOG_FILE")/deployed-contracts-${NETWORK}.txt"
}

# ─── Contract list ────────────────────────────────────────────────────────────
# Deployment order matters: token contracts before contracts that depend on them.
ALL_CONTRACTS=(
  "tycoon_token"
  "tycoon_reward_system"
  "tycoon_collectibles"
  "tycoon_boost_system"
  "tycoon_game"
  "tycoon_main_game"
)

# ─── Main ─────────────────────────────────────────────────────────────────────
if [[ "$CONTRACT" == "all" ]]; then
  for c in "${ALL_CONTRACTS[@]}"; do
    deploy_contract "$c"
  done
else
  deploy_contract "${CONTRACT//-/_}"
fi

info "=== Deployment complete ==="
info "See deploy log: $LOG_FILE"
info "Next step: run post-deploy verification:"
info "  ./scripts/verify-deploy.sh --network $NETWORK"
