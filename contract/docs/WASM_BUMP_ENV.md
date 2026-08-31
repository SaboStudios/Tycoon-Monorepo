# WASM Env Bump Guide

After a tagged WASM release, new contract hashes must flow into:

- **Frontend** — `NEXT_PUBLIC_CONTRACT_<NAME>` env vars (Vercel dashboard)
- **Backend** — `CONTRACT_<NAME>` env vars (k8s / `.env.production`)

This must be done **manually** by an operator with production access. The CI
workflow intentionally does not write or commit these values.

---

## Hash file format

`contract/deploy/wasm-hashes.txt` (also attached to the GitHub Release):

```
<sha256-hex>  tycoon_main_game.wasm
<sha256-hex>  tycoon_game.wasm
<sha256-hex>  tycoon_token.wasm
<sha256-hex>  tycoon_reward_system.wasm
<sha256-hex>  tycoon_collectibles.wasm
<sha256-hex>  tycoon_boost_system.wasm
<sha256-hex>  tycoon_lib.wasm
```

One line per contract. Each line is:

```
<64 hex chars><two spaces><filename>.wasm
```

This is the standard `sha256sum` output format, so you can verify locally:

```bash
cd contract
sha256sum -c deploy/wasm-hashes.txt
```

---

## Step-by-step bump

### 1. Find the release

1. Go to **GitHub → Releases** and open the release for the new tag (e.g. `v1.2.3`).
2. Download `wasm-hashes.txt` from the release assets.
3. Open the file and copy the hash for each contract you are deploying.

### 2. Update frontend env vars (Vercel)

1. Open **Vercel → Project → Settings → Environment Variables**.
2. For each changed contract, set (or update):
   ```
   NEXT_PUBLIC_CONTRACT_MAIN_GAME_HASH=<sha256-hex>
   NEXT_PUBLIC_CONTRACT_TOKEN_HASH=<sha256-hex>
   # … etc.
   ```
3. Select the target environments (Production / Preview / Development).
4. Click **Save**.
5. Trigger a redeploy (Vercel → Deployments → Redeploy latest).

> ⚠️ These variables are **public** — they are inlined into the JS bundle.
> They contain hashes only, never secrets or private keys.

### 3. Update backend env vars (k8s / .env.production)

1. Open the relevant k8s Secret or `.env.production` (never commit `.env.production`).
2. Update:
   ```env
   CONTRACT_MAIN_GAME_HASH=<sha256-hex>
   CONTRACT_TOKEN_HASH=<sha256-hex>
   # … etc.
   ```
3. For k8s: `kubectl create secret generic tycoon-contract-hashes --from-env-file=.env.contracts --dry-run=client -o yaml | kubectl apply -f -`
4. Roll the backend deployment: `kubectl rollout restart deployment/tycoon-backend`

### 4. Verify

After deploy, hit the health endpoint and confirm the backend boots without
contract hash mismatch errors:

```bash
curl https://api.tyns.app/health
```

And confirm the frontend loads the correct contract hash in the browser console
or via `NEXT_PUBLIC_CONTRACT_*` inspection.

---

## Do NOT

- Commit `wasm-hashes.txt` to the repo root or any env file — it belongs in
  `contract/deploy/` which is already in the repo and versioned.
- Set contract env vars via automated CI scripts — always use the dashboard or a
  secure secrets manager with a paper trail.
- Skip the second-pair-of-eyes review for production changes.

---

## Depends on: crates restore

This workflow depends on the Soroban/Rust crates being available. If the Cargo
registry is unreachable, the build step will fail. No partial releases are
possible — the hash file is only written after all WASM artifacts build
successfully.

See the [contract README](../README.md) for local build instructions.
