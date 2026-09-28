import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Database options for the Postgres-backed e2e tier (`*.pg-e2e-spec.ts`,
 * run by `scripts/e2e-compose-ci.sh` against docker-compose.ci.yml).
 *
 * The suites use `synchronize` + `dropSchema`, which DESTROYS the target
 * schema. To make that impossible outside a disposable test database this
 * fails closed unless:
 *   - NODE_ENV is `test`, and
 *   - DB_DATABASE ends in `_test` or `_ci` (e.g. `tycoon_test`, `tycoon_ci`).
 *
 * Connection values come from DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD /
 * DB_DATABASE with no silent defaults (see backend/test/README.md).
 */
export function pgE2eDatabaseOptions(): TypeOrmModuleOptions {
  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
  ] as const;
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `[pg-e2e] Missing required env: ${missing.join(', ')}. ` +
        'Run via `npm run test:e2e:compose` (scripts/e2e-compose-ci.sh), ' +
        'which starts docker-compose.ci.yml and exports these.',
    );
  }

  const database = process.env.DB_DATABASE as string;
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `[pg-e2e] Refusing to run: NODE_ENV must be "test" (got "${process.env.NODE_ENV}").`,
    );
  }
  if (!/_(test|ci)$/.test(database)) {
    throw new Error(
      `[pg-e2e] Refusing to drop schema of "${database}": the database name ` +
        'must end in "_test" or "_ci".',
    );
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database,
    autoLoadEntities: true,
    synchronize: true,
    dropSchema: true,
    logging: false,
  };
}
