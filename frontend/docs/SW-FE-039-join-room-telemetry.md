# SW-FE-039 — Join Room Flow: Telemetry Hooks (Privacy-Safe)

Part of the **Stellar Wave** engineering batch.

## What changed

| File | Change |
|------|--------|
| `src/hooks/useJoinRoomTelemetry.ts` | New hook — `trackFormViewed`, `trackJoinAttempted`, `trackJoinSucceeded`, `trackJoinFailed`. All payloads routed through `sanitizeAnalyticsPayload` via `track()`. |
| `src/lib/analytics/taxonomy.ts` | Added 4 new events: `join_room_form_viewed`, `join_room_attempted`, `join_room_succeeded`, `join_room_failed`. Schemas contain only non-linkable fields (`route`, `source`, `error_type`). |
| `lib/analytics/providers.ts` | Deny-by-default provider registry — unknown/unregistered providers throw at module load so the build fails instead of silently dropping or misrouting events. |
| `test/useJoinRoomTelemetry.test.ts` | New file — 14 unit tests covering all hook methods, custom route/source overrides, all `error_type` variants, and PII-safety assertions. |
| `docs/SW-FE-039-join-room-telemetry.md` | This file. |

## Privacy guarantees

- **No room codes** — the 6-char code is never included in any event payload.
- **No user IDs, wallet addresses, or session tokens** — blocked by `sanitizeAnalyticsPayload` and absent from taxonomy schemas.
- **No wall-clock timestamps** — events carry only `route`, `source`, and `error_type`.
- SSR-safe: `track()` is a no-op server-side (guarded in `analytics/client.ts`).

## Consent gating

Telemetry is **consent-aware**: no event is emitted until the user has granted
analytics consent. The hook reads consent from the analytics client before
dispatching, and `track()` itself is a no-op when consent is absent or
`NEXT_PUBLIC_ENABLE_ANALYTICS=false`. This keeps the join-room funnel
GDPR/CCPA-safe by default and avoids any pre-consent beacons.

## Provider registry (deny-by-default)

`lib/analytics/providers.ts` is the single source of truth for allowed
providers. Any provider id that is not explicitly registered throws at module
evaluation time, so an unknown provider fails the build rather than shipping a
silent no-op or leaking events to an unvetted endpoint. Adding a provider
requires a code change plus review — there is no runtime registration path.

## Feature flag / rollout

The hook is exported but **not yet wired into `JoinRoomForm`**. Wire-up is a
follow-on task once the analytics pipeline is confirmed in staging.

To enable in `JoinRoomForm`:
```tsx
const { trackJoinAttempted, trackJoinSucceeded, trackJoinFailed } = useJoinRoomTelemetry();
// call inside handleSubmit at the appropriate points
```

No feature flag required — the analytics client already respects
`NEXT_PUBLIC_ENABLE_ANALYTICS=false` to suppress all events, and the hook
additionally gates on explicit user consent.

## Verification

```bash
cd frontend
npm run typecheck
npm run test -- --reporter=verbose test/useJoinRoomTelemetry.test.ts
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-039
- [x] `npm run test` — all 14 new cases green
- [x] `npm run typecheck` passes
- [x] No new production dependencies
- [x] No PII fields in any taxonomy schema
- [x] Telemetry emitted only after explicit consent
- [x] Unknown analytics providers fail the build (deny-by-default registry)
