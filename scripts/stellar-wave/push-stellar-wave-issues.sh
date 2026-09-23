#!/usr/bin/env bash
# Create GitHub issues from generated Stellar Wave markdown files.
# Prerequisites: GitHub CLI (`gh`) authenticated (`gh auth login`).
#
# Usage:
#   node scripts/stellar-wave/generate-stellar-wave-issues.mjs   # generate files first
#   ./scripts/stellar-wave/push-stellar-wave-issues.sh           # create all issues
#
# Optional:
#   DRY_RUN=1 ./scripts/stellar-wave/push-stellar-wave-issues.sh
#   RESUME_AREA=backend RESUME_FROM=7 ./scripts/stellar-wave/push-stellar-wave-issues.sh
#
# RESUME_AREA  — skip areas before this (frontend | backend | contract)
# RESUME_FROM  — 1-based file index to start within RESUME_AREA (default: 1)

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
if [[ -n "${RESUME_AREA:-}" ]]; then
  echo "Resume: area=${RESUME_AREA} from index ${RESUME_FROM:-1}"
fi
echo ""

ensure_label "frontend" "1D4ED8" "Next.js / client"
ensure_label "backend" "CA8A04" "NestJS / API"
ensure_label "contract" "16A34A" "Soroban / Stellar contracts"

# Returns 0 if we should skip this entire area (already pushed).
area_is_before_resume() {
  local area="$1"
  local resume="${RESUME_AREA:-}"
  [[ -z "${resume}" ]] && return 1
  local order="frontend backend contract"
  local seen_resume=0
  for a in ${order}; do
    [[ "${a}" == "${resume}" ]] && seen_resume=1
    if [[ "${a}" == "${area}" ]]; then
      [[ ${seen_resume} -eq 0 ]] && return 0
      return 1
    fi
  done
  echo "Unknown RESUME_AREA: ${resume}" >&2
  exit 1
}

create_from_dir() {
  local area="$1"
  local gh_label="$2"

  if area_is_before_resume "${area}"; then
    echo "[${area}] Skipped (before RESUME_AREA=${RESUME_AREA})"
    return 0
  fi

  shopt -s nullglob
  local files=("${ISSUES_DIR}/${area}"/*.md)
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No markdown files in ${ISSUES_DIR}/${area}" >&2
    return 1
  fi

  local start_index=1
  if [[ -n "${RESUME_AREA:-}" && "${area}" == "${RESUME_AREA}" ]]; then
    start_index="${RESUME_FROM:-1}"
  fi

  local total=${#files[@]}
  local n=0
  local created=0
  local skipped=0

  for f in "${files[@]}"; do
    n=$((n + 1))
    if [[ ${n} -lt ${start_index} ]]; then
      skipped=$((skipped + 1))
      continue
    fi

    local title
    title="$(node -e "
      const m = require('${ISSUES_DIR}/manifest.json');
      const hit = m.find((e) => e.path.endsWith('/$(basename "$f")'));
      if (!hit) process.exit(1);
      process.stdout.write(hit.title);
    ")"
    local tmp
    tmp="$(mktemp)"
    cp "$f" "$tmp"
    if [[ -n "${DRY_RUN:-}" ]]; then
      echo "[DRY_RUN ${area} ${n}/${total}] ${title}"
      rm -f "$tmp"
      created=$((created + 1))
      continue
    fi
    echo "[${area} ${n}/${total}] Creating: ${title:0:80}..."
    gh issue create \
      --title "${title}" \
      --body-file "$tmp" \
      --label "${gh_label}"
    rm -f "$tmp"
    created=$((created + 1))
    sleep 0.4
  done

  echo "[${area}] Created ${created}, skipped ${skipped} (resume/start index ${start_index})"
}

create_from_dir "frontend" "frontend"
create_from_dir "backend" "backend"
create_from_dir "contract" "contract"

echo ""
echo "Done. Re-run with RESUME_AREA / RESUME_FROM to continue after a partial push."
