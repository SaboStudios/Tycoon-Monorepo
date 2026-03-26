# Issue #400 Progress: Idempotent Game Init + Safe Views

## Approved Plan Steps
- [ ] 1. Create branch blackboxai/issue-400
- [x] 2. Create/refactor backend/src/database/seeds/game-seed.ts (idempotent defaults)
- [x] 3. Add getSafeGameView to backend/src/modules/games/games.service.ts
 - [x] 4. Create backend/test/game-idempotency.e2e-spec.ts (double seed + view safe)
 - [x] 5. Update backend/README.md (docs defaults/migration/upgrade)

- [ ] 6. Commit changes
- [ ] 7. Push branch
- [ ] 8. Create PR #400

Current: Starting implementation.

