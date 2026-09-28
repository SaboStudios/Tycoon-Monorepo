# SW-FE-1760 — Farcaster well-known manifest security

Issue: #1760. Route: `GET /.well-known/farcaster.json`.

## What changed and why

The old `frontend/public/.well-known/farcaster.json/route.ts` has been removed.
It had four problems:

- Next.js does not run a `route.ts` placed under `public/`, so the endpoint
  never worked.
- It imported `minikit.config`, which does not exist in the repo.
- It hardcoded another project's domain (`base-monopoly.vercel.app`), so a
  copied manifest would have claimed the wrong domain.
- Its folder was hidden from `tsc`, so none of the above was caught.

It has been replaced by:

| File | Role |
|---|---|
| `src/app/.well-known/farcaster.json/route.ts` | Route handler. Only `GET` is exported, so other methods get 405. |
| `src/lib/farcaster/manifest.ts` | Builds and validates the manifest; returns fixed error codes |
| `test/farcaster-manifest.test.ts` | Vitest: validation, spoofing, route headers, no values in logs |
| `e2e/farcaster-manifest.spec.ts` | Playwright check against the running app |

`tsconfig.json` now includes `src/app/.well-known/**/*.ts` explicitly, because
TypeScript's `**` glob skips folders whose names start with a dot.

## Security model

- **Deny-by-default.** The route returns `404 {"error":"not_found"}` with
  `Cache-Control: no-store` unless all of the following hold:
  - `NEXT_PUBLIC_APP_URL` is a bare, public `https://` origin: no path, query,
    or credentials, and not localhost or a private-range address;
  - all three `FARCASTER_ACCOUNT_ASSOCIATION_*` variables are set, are
    base64url, and are each at most 2 KB;
  - the header decodes to `{fid>0, type: custody|auth|app_key, key}`;
  - the payload decodes to `{domain}`, and that domain **exactly equals** the
    host of `NEXT_PUBLIC_APP_URL`. A parent domain or another deployment's
    association is rejected.
- **No open redirects or third-party assets.** Every URL in the manifest is
  built from the app origin plus a fixed path in `manifest.ts`. The assembled
  manifest is then checked again: every URL must be `https` and same-origin.
- **No webhook.** `webhookUrl` is not emitted. A webhook would be an
  unauthenticated inbound entrypoint. Adding one needs its own issue covering
  JSON Farcaster Signature verification, rate limiting, and idempotent
  handling of replayed events.
- **Safe copy.** Text fields are length-capped and limited to plain text (no
  markup). The copy is NEAR-neutral and passes the ADR-003 deny-list (tested).
- **No secrets, no leaked values.** The account association is public once
  served, but it belongs to one deployment, so it lives in server-only env and
  never in the repo. Logs contain only a reason code such as
  `association_domain_mismatch`, once per distinct reason, and never an env
  value.
- **Discovery.** `noindex` is `true` unless `NEXT_PUBLIC_APP_ENV=production`,
  which keeps previews and staging out of Farcaster app search.
- **Signature.** Farcaster clients verify the cryptographic signature. This
  route checks the envelope's shape and domain binding, so it never publishes
  an association that cannot possibly verify for this host.

### Embedding is intentionally not enabled

The CSP sends `frame-ancestors 'none'`, so Farcaster clients cannot embed the
app in an iframe. This manifest publishes metadata and the domain
association only. Launching as an embedded mini app would mean relaxing
`frame-ancestors` for specific client origins and integrating the mini app
SDK. That is a separate clickjacking and security review, out of scope here.

## Operator runbook

### Enable on a deployment

1. Decide the exact public host, for example `play.example.com`. It must equal
   the host in `NEXT_PUBLIC_APP_URL`.
2. Sign the domain with the Farcaster account that should own the app, using
   the Farcaster developer manifest tool. The tool gives you `header`,
   `payload` and `signature`.
3. Put the three values in the deployment's secret store, not the repo:
   ```bash
   FARCASTER_ACCOUNT_ASSOCIATION_HEADER=<header>
   FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD=<payload>
   FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE=<signature>
   ```
   For k8s, add the keys to the `frontend-secrets` Secret. The keys are
   already wired into `frontend/k8s/deployment.yaml` as optional
   `secretKeyRef`s, so pods still start without them (and serve 404):
   ```bash
   kubectl create secret generic frontend-secrets --dry-run=client -o yaml \
     --from-literal=FARCASTER_ACCOUNT_ASSOCIATION_HEADER=<header> \
     --from-literal=FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD=<payload> \
     --from-literal=FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE=<signature> \
     | kubectl apply -f -
   ```
   Warning: `kubectl apply` replaces the Secret's data. Include the existing
   keys (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL`) in the same
   command, or use `kubectl patch`, then run
   `kubectl rollout restart deploy/tycoon-frontend`.
4. Redeploy, then verify:
   ```bash
   curl -si https://play.example.com/.well-known/farcaster.json | head -20
   # Expect 200, Content-Type: application/json, Cache-Control: public, max-age=300
   ```
   If you get a 404, the server log line `[farcaster] manifest not served: <reason>`
   names the check that failed.

### Rotate

Replace the three values and redeploy. Clients see the new manifest within
five minutes (`max-age=300`).

### Roll back or disable

Unset any one of the three variables and redeploy. The route immediately
returns 404 with `no-store`. No data migration is involved.

### Reason codes

| Code | Fix |
|---|---|
| `association_missing` | Not configured; this is the expected default. Nothing is logged. |
| `association_incomplete` | Set all three variables. |
| `association_malformed` / `_header_invalid` / `_payload_invalid` | Re-copy the values from the manifest tool without extra quotes or whitespace. |
| `association_domain_mismatch` | Re-sign for the host in `NEXT_PUBLIC_APP_URL`. |
| `app_url_*` | Set `NEXT_PUBLIC_APP_URL` to the public `https://host` origin. |

## Tests

```bash
cd frontend
npx vitest run test/farcaster-manifest.test.ts
npx playwright test e2e/farcaster-manifest.spec.ts
```
