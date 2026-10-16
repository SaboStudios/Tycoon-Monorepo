/**
 * Resolves whether TypeORM should synchronize the database schema.
 *
 * This is a safety-critical guard: a running service must never mutate its
 * own schema. Synchronization is only enabled for the test environment, and
 * is explicitly rejected when a staging-like environment tries to enable it.
 *
 * @returns true only when NODE_ENV is 'test'.
 * @throws when NODE_ENV contains 'staging' and DB_SYNCHRONIZE is 'true'.
 */
export function resolveSynchronize(): boolean {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'test') {
    return true;
  }

  if (nodeEnv && nodeEnv.includes('staging') && process.env.DB_SYNCHRONIZE === 'true') {
    throw new Error(
      'DB_SYNCHRONIZE must not be enabled in staging environments',
    );
  }

  return false;
}
