#!/usr/bin/env bash
# Fails when docs/ENVIRONMENT.md and a package's .env.example disagree.
#
# The doc tells contributors to copy each .env.example, so a variable that is
# documented but absent from the example (or declared in the example but
# undocumented) sends someone to production with a missing setting. Comparing
# names in both directions is what keeps the doc from going aspirational.
set -euo pipefail

cd "$(dirname "$0")/.."
DOC=docs/ENVIRONMENT.md
status=0

# Variables listed in the doc's table rows for one package section. Section
# headings embed the example path, e.g. "## Backend (`backend/.env.example`)".
documented() {
  awk -v want="(\`$1\`)" '
    index($0, "## ") == 1 { in_section = index($0, want) > 0; next }
    in_section && /^\| `[A-Z]/ { gsub(/`/, "", $2); print $2 }
  ' "$DOC" | sort -u
}

declared() { grep -Eo '^[A-Z][A-Z0-9_]*=' "$1" | tr -d '=' | sort -u; }

report() { # label, path, var list
  [ -z "$3" ] && return 0
  printf '%s in %s:\n' "$1" "$2" >&2
  printf '  - %s\n' $3 >&2
  status=1
}

for example in .env.example backend/.env.example frontend/.env.example \
               shop-api/.env.example; do
  if [ ! -f "$example" ]; then
    printf 'missing example file: %s\n' "$example" >&2
    status=1
    continue
  fi
  doc_vars=$(documented "$example")
  file_vars=$(declared "$example" || true)
  report 'Documented but not declared' "$example" \
    "$(comm -23 <(printf '%s\n' "$doc_vars") <(printf '%s\n' "$file_vars"))"
  report 'Declared but not documented' "$example" \
    "$(comm -13 <(printf '%s\n' "$doc_vars") <(printf '%s\n' "$file_vars"))"
done

if [ "$status" -eq 0 ]; then
  echo "docs/ENVIRONMENT.md matches every .env.example"
else
  echo "Update docs/ENVIRONMENT.md or the example above so the two agree." >&2
fi
exit "$status"
