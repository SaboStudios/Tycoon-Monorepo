#!/usr/bin/env bash
# Compare release WASM sizes against contract/ci/wasm-size-budget.json.
# Fails if any contract grows beyond regression_threshold_percent vs baseline.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUDGET="$CONTRACT_ROOT/ci/wasm-size-budget.json"
TARGET="$CONTRACT_ROOT/target/wasm32-unknown-unknown/release"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
REPORT="$CONTRACT_ROOT/deploy/wasm-size-report.md"
mkdir -p "$(dirname "$REPORT")"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for WASM size checks"
  exit 1
fi

if [[ ! -f "$BUDGET" ]]; then
  echo "Missing budget file: $BUDGET"
  exit 1
fi

THRESHOLD_PCT="$(jq -r '.regression_threshold_percent' "$BUDGET")"
VERSION="$(jq -r '.version' "$BUDGET")"

FAILED=0

{
  echo "## WASM size check (budget v${VERSION})"
  echo ""
  echo "Regression threshold: **${THRESHOLD_PCT}%** over committed baseline (deployment cost / rent awareness)."
  echo ""
  echo "| Contract | Baseline (B) | Current (C) | Δ (C−B) | Max allowed (⌊B×(100+${THRESHOLD_PCT})/100⌋) | Status |"
  echo "|----------|-------------:|------------:|--------:|----------------------------------------------:|:-------|"
} >"$REPORT"

while IFS= read -r line; do
  name="$(echo "$line" | jq -r '.key')"
  baseline="$(echo "$line" | jq -r '.value.baseline_bytes')"
  path="$TARGET/$name"
  if [[ ! -f "$path" ]]; then
    echo "ERROR: expected WASM not found: $path (build release wasm first)"
    echo "| \`$name\` | $baseline | — | — | — | ❌ missing |" >>"$REPORT"
    FAILED=1
    continue
  fi
  if [[ "$OSTYPE" == "darwin"* ]]; then
    current="$(stat -f%z "$path")"
  else
    current="$(stat -c%s "$path")"
  fi
  delta=$((current - baseline))
  max_allowed=$(( baseline * (100 + THRESHOLD_PCT) / 100 ))

  status="✅"
  if (( current > max_allowed )); then
    status="❌ regression"
    FAILED=1
  fi

  echo "| \`$name\` | $baseline | $current | $delta | $max_allowed | $status |" >>"$REPORT"
done < <(jq -c '.contracts | to_entries[]' "$BUDGET")

echo "" >>"$REPORT"
cat "$REPORT" >>"$SUMMARY"

if [[ "$FAILED" -ne 0 ]]; then
  echo "WASM size regression: one or more contracts exceed baseline + ${THRESHOLD_PCT}%." >&2
  echo "Intentional increase: update \`contract/ci/wasm-size-budget.json\` in the same PR with justification." >&2
  exit 1
fi

echo "All WASM artifacts within size budget."
exit 0
