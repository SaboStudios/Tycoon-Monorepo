#!/usr/bin/env bash
# Create GitHub issues from generated Stellar Wave markdown files.
# Prerequisites: GitHub CLI (`gh`) authenticated (`gh auth login`).
#
# Usage:
#   node scripts/stellar-wave/generate-stellar-wave-issues.mjs   # generate files first
#   ./scripts/stellar-wave/push-stellar-wave-issues.sh           # create all issues
#
# Optional: DRY_RUN=1 ./scripts/stellar-wave/push-stellar-wave-issues.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ISSUES_DIR="${ROOT}/stellar-wave-issues"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/" >&2
  exit 1
fi

if [[ ! -d "${ISSUES_DIR}/frontend" ]]; then
  echo "Missing ${ISSUES_DIR}. Run: node scripts/stellar-wave/generate-stellar-wave-issues.mjs" >&2
  exit 1
fi

ensure_label() {
  local name="$1"
  local color="$2"
  local desc="$3"
  gh label create "${name}" --color "${color}" --description "${desc}" 2>/dev/null || true
}

REPO="${GITHUB_REPOSITORY:-}"
if [[ -z "${REPO}" ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
fi
echo "Repository: ${REPO:-'(default from gh)'}"
echo ""

ensure_label "Stellar Wave" "0E7490" "Stellar Wave program / batch"
ensure_label "frontend" "1D4ED8" "Next.js / client"
ensure_label "backend" "CA8A04" "NestJS / API"
ensure_label "contract" "16A34A" "Soroban / Stellar contracts"

create_from_dir() {
  local area="$1"
  local gh_label="$2"
  shopt -s nullglob
  local files=("${ISSUES_DIR}/${area}"/*.md)
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No markdown files in ${ISSUES_DIR}/${area}" >&2
    return 1
  fi
  for f in "${files[@]}"; do
    local title
    title="$(sed -n '1p' "$f" | sed 's/^# //')"
    local tmp
    tmp="$(mktemp)"
    tail -n +3 "$f" > "$tmp"
    if [[ -n "${DRY_RUN:-}" ]]; then
      echo "[DRY_RUN] would create: ${title}"
      rm -f "$tmp"
      continue
    fi
    gh issue create \
      --title "${title}" \
      --body-file "$tmp" \
      --label "Stellar Wave" \
      --label "${gh_label}"
    rm -f "$tmp"
    sleep 0.35
  done
}

create_from_dir "frontend" "frontend"
create_from_dir "backend" "backend"
create_from_dir "contract" "contract"

echo ""
echo "Done. If rate-limited, re-run; duplicate titles are not deduplicated by this script."
