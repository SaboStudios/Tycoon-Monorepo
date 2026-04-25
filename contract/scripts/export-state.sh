#!/bin/bash
set -e

# Default values
NETWORK="testnet"
CONTRACT_ID=""

# Usage info
usage() {
  echo "Usage: $0 --contract-id <id> [--network <testnet|mainnet>]"
  exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --network)
      NETWORK="$2"
      shift 2
      ;;
    --contract-id)
      CONTRACT_ID="$2"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

if [ -z "$CONTRACT_ID" ]; then
  usage
fi

echo "--- Exporting state for contract $CONTRACT_ID on $NETWORK ---"

# Use stellar-cli to invoke the export_state view method
# This assumes the user has stellar-cli installed and configured
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network "$NETWORK" \
  -- \
  export_state

echo "--- Export Complete ---"
echo "Note: Sensitive private keys are NEVER stored in contract state and thus not included in this dump."
