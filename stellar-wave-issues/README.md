# Stellar Wave — GitHub issues (batch)

This folder holds **375** issue drafts split by surface area:

| Folder       | Count |
|-------------|-------|
| `frontend/` | 125   |
| `backend/`  | 125   |
| `contract/` | 125   |

Each file is the issue **body** only (starts with `Description (Frontend|Backend|Contract)`). GitHub titles live in `manifest.json` — no `#` title line in the markdown files.

Issues are generated from a repo scan (routes, modules, crates) plus explicit **[Restore]** items for code removed in the cleanup batch.

## Generate

From the monorepo root:

```bash
npm run issues:stellar-wave:generate
# or
node scripts/stellar-wave/generate-stellar-wave-issues.mjs
```

This refreshes `frontend/`, `backend/`, `contract/`, and `manifest.json`.

## Push to GitHub

Requires [GitHub CLI](https://cli.github.com/) and `gh auth login`.

```bash
npm run issues:stellar-wave:push
```

Dry run (print titles only):

```bash
DRY_RUN=1 ./scripts/stellar-wave/push-stellar-wave-issues.sh
```

### Continue after a partial push

Files are processed in sorted filename order (`001-...`, `002-...`). If you already pushed some issues, resume with:

```bash
# Example: frontend done (125), backend stopped at file 6 — continue from backend #7
RESUME_AREA=backend RESUME_FROM=7 ./scripts/stellar-wave/push-stellar-wave-issues.sh
```

Preview resume:

```bash
DRY_RUN=1 RESUME_AREA=backend RESUME_FROM=7 ./scripts/stellar-wave/push-stellar-wave-issues.sh
```

| Variable       | Meaning |
|----------------|---------|
| `RESUME_AREA`  | Skip `frontend` / `backend` / `contract` until this area |
| `RESUME_FROM`  | 1-based index in that area (`007-...md` → `7`) |

The script creates labels if missing: **frontend**, **backend**, **contract**, and applies the area label only (no Stellar Wave label).

**Note:** Running without `RESUME_*` after a partial push will **duplicate** issues already on GitHub.
