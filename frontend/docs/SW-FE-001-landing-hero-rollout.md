# SW-FE-001 - Landing Hero CLS/LCP Rollout
This change is part of the Stellar Wave frontend batch and targets home page hero performance.
## Scope
- Eager render the above-the-fold hero on `/`.
- Defer below-the-fold sections with lightweight placeholders.
- Stabilize animated hero copy to reduce layout movement.
## Feature Flag Plan
No runtime flag is added in this patch to keep bundle/runtime complexity low.
Use a staged rollout instead:
1. Deploy to preview and compare Core Web Vitals (LCP/CLS) vs baseline.
2. Deploy to a low-traffic environment first (internal/canary).
3. Promote to full production once no regressions are observed.
If rollback is needed, revert this single patch set touching `HomeClient` and hero components.
## Migration Notes
- No API changes.
- No schema/data migration.
- No user action required.
## Verification Checklist
- `npm run typecheck`
- `npm run test`
- Confirm home route renders primary CTA and title immediately on first paint.
- Monitor LCP and CLS in production telemetry after deploy.
