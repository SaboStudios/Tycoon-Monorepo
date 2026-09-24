#!/usr/bin/env bash
# =============================================================================
# create-dev-subaccounts.sh — Provision personal dev subaccounts on Stellar testnet
#
# Usage:
#   ./scripts/create-dev-subaccounts.sh <dev-alias>
#
# Example:
#   ./scripts/create-dev-subaccounts.sh alice
#   # Creates key "dev-alice" in stellar CLI keystore and funds via Friendbot.
#
# What it does:
#   1. Generates a new keypair stored in stellar CLI's encrypted keystore.
#   2. Funds the account via Friendbot (10,000 XLM on testnet — free).
#   3. Prints the public key for use in .env.testnet.local.
#
# Requirements:
#   - stellar CLI >= 21.0.0  (cargo install stellar-cli --features opt)
#   - curl
#
# Policy:
#   - Each developer gets their OWN subaccount. Never share private keys.
#   - Deploy your own contract instance; do not write to the shared contract.
#   - See docs/TESTNET_DEV_ONBOARDING.md for the full policy.
# =============================================================================

set -euo pipefail

ALIAS="${1:-}"
if [[ -z "$ALIAS" ]]; then
  echo "Usage: $0 <dev-alias>  (e.g. alice)" >&2
  exit 1
fi

KEY_NAME="dev-${ALIAS}"
FRIENDBOT_URL="https://friendbot.stellar.org"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

command -v stellar &>/dev/null || error "stellar CLI not found. Install: cargo install stellar-cli --features opt"
command -v curl    &>/dev/null || error "curl not found."

# ── 1. Generate keypair (skip if already exists) ──────────────────────────────
if stellar keys address "$KEY_NAME" &>/dev/null 2>&1; then
  warn "Key '$KEY_NAME' already exists in keystore — skipping generation."
else
  info "Generating keypair '$KEY_NAME'..."
  stellar keys generate "$KEY_NAME" --network testnet --no-fund
  info "Keypair created."
fi

PUBKEY=$(stellar keys address "$KEY_NAME")
info "Public key: $PUBKEY"

# ── 2. Fund via Friendbot ─────────────────────────────────────────────────────
info "Funding via Friendbot..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "${FRIENDBOT_URL}?addr=${PUBKEY}")

if [[ "$HTTP_STATUS" == "200" ]]; then
  info "Funded successfully (10,000 XLM)."
elif [[ "$HTTP_STATUS" == "400" ]]; then
  warn "Friendbot returned 400 — account may already be funded. Continuing."
else
  error "Friendbot request failed (HTTP $HTTP_STATUS). Check https://status.stellar.org."
fi

# ── 3. Verify account exists on-chain ─────────────────────────────────────────
info "Verifying account on testnet..."
stellar account show "$PUBKEY" --network testnet 2>/dev/null \
  && info "Account confirmed on testnet." \
  || warn "Account not yet visible — Friendbot may be slow. Retry in ~10 s."

# ── 4. Print next steps ───────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Dev account ready: $KEY_NAME"
echo "  Public key:        $PUBKEY"
echo ""
echo "  To deploy your own contract instance:"
echo "    export DEV_ACCOUNT=\"$PUBKEY\""
echo "    ./scripts/deploy.sh --network testnet --contract tycoon-game --skip-hash"
echo ""
echo "  To top up XLM later (Friendbot only works once per account):"
echo "    curl \"${FRIENDBOT_URL}?addr=${PUBKEY}\""
echo ""
echo "  See docs/TESTNET_DEV_ONBOARDING.md for the full dev policy."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
