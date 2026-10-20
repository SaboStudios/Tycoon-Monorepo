# Stellar Wave — GitHub issues (batch)

This folder holds **125** issue drafts split by surface area:

| Folder       | Count |
|-------------|-------|
| `frontend/` | 42    |
| `backend/`  | 42    |
| `contract/` | 41    |

Each file is Markdown: first line is the GitHub **title** (`# ...`), then the issue **body** (Description, Tasks, Additional Requirements, Acceptance Criteria). Every body includes **Stellar Wave** and the area label.

## Generate

From the monorepo root:

```bash
node scripts/stellar-wave/generate-stellar-wave-issues.mjs
```

This refreshes `frontend/`, `backend/`, `contract/`, and `manifest.json`.

## Push to GitHub

Requires [GitHub CLI](https://cli.github.com/) and `gh auth login`.

```bash
chmod +x scripts/stellar-wave/push-stellar-wave-issues.sh
./scripts/stellar-wave/push-stellar-wave-issues.sh
```

Dry run (print titles only):

```bash
DRY_RUN=1 ./scripts/stellar-wave/push-stellar-wave-issues.sh
```

The script creates labels if missing: **Stellar Wave**, **frontend**, **backend**, **contract**, and applies the matching pair to each issue.

**Note:** Re-running the push script will **create duplicate issues** unless you delete or archive the generated files first. Use a fresh repo or adjust the script for idempotency if needed.
