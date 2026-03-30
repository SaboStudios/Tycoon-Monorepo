# Contract Upgrade and State Migration Limitations

This document outlines scenarios where state migration may be complex or rollback is impossible.

## State Schema Versioning
Each contract now contains a `StateVersion` storage item (u32 byte). The initial version is `1`.

## Migration Functions
Migration is handled via the `migrate()` function in each contract, which:
- Must be called by the `Admin` or `Owner`.
- Checks the current `StateVersion`.
- Applies necessary transformations to reach the target version.
- Updates `StateVersion` upon completion.

## Rollback Limitations

### Persisted State Deletion
If a migration involves deleting old storage keys (to save on rent or due to schema changes), this action is permanent. Reverting to an older contract version will NOT restore deleted state.

### Large Data Migrations
For contracts with high numbers of users or collectibles, a single-transaction migration might exceed the Soroban resource limits (CPU/Read/Write). In these cases:
- Migration must be performed in chunks.
- The contract may be left in a "partially migrated" state which is difficult to rollback without careful Snapshotting.

### Events
Events emitted during migration cannot be "un-emitted". If a migration is rolled back at the contract logic level, the ledger history will still reflect the migration events.

### Token Transfers
If a migration includes transferring tokens out of the contract (e.g., to a new vault structure), these transfers are irreversible on-chain.

## Best Practices
1. **Always test on a forked state snapshot** before applying to Testnet or Mainnet.
2. **Implement idempotency** in `migrate()` so it can be safely re-run if it fails mid-execution.
3. **Keep old state logic** readable in the migration code (as comments) for future reference.
