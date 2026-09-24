import { registerAs } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load .env for TypeORM CLI (Nest uses ConfigModule separately)
dotenv.config();

/**
 * Entity auto-sync is only allowed in local development.
 * Production and provision NEVER synchronize — schema changes must go through migrations.
 */
export function resolveTypeOrmSynchronize(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production' || nodeEnv === 'provision') {
    if (process.env.DB_SYNCHRONIZE === 'true') {
      console.warn(
        '[database] DB_SYNCHRONIZE is ignored when NODE_ENV is production or provision. Apply versioned migrations instead.',
      );
    }
    return false;
  }
  return process.env.DB_SYNCHRONIZE === 'true';
}

/**
 * Pool defaults per environment:
 *
 * local/test  — small pool; no SSL; generous idle timeout so dev containers
 *               don't exhaust connections after repeated test runs.
 * production  — sized for RDS max_connections (default 100 on db.t3.medium).
 *               Keep pool ≤ 20 per instance so multiple replicas fit.
 *               Idle timeout < RDS idle client timeout (600 s default) to
 *               prevent "connection reset" errors on long-running workers.
 * provision   — same as production.
 */
function resolvePoolOptions(): {
  poolSize: number;
  idleTimeoutMs: number;
  statementTimeoutMs: number;
  connectTimeoutMs: number;
} {
  const env = process.env.NODE_ENV ?? 'development';
  const isProd = env === 'production' || env === 'provision';

  return {
    poolSize: parseInt(
      process.env.DB_POOL_SIZE ?? (isProd ? '20' : '5'),
      10,
    ),
    idleTimeoutMs: parseInt(
      process.env.DB_POOL_IDLE_TIMEOUT_MS ?? (isProd ? '30000' : '10000'),
      10,
    ),
    statementTimeoutMs: parseInt(
      process.env.DB_STATEMENT_TIMEOUT_MS ?? (isProd ? '30000' : '0'),
      10,
    ),
    connectTimeoutMs: parseInt(
      process.env.DB_CONNECT_TIMEOUT_MS ?? '5000',
      10,
    ),
  };
}

function buildDataSourceOptions(): DataSourceOptions {
  const pool = resolvePoolOptions();
  const isProd =
    (process.env.NODE_ENV ?? 'development') === 'production' ||
    process.env.NODE_ENV === 'provision';

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'tycoon_db',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: resolveTypeOrmSynchronize(),
    logging: process.env.DB_LOGGING === 'true',
    migrations: [__dirname + '/../database/migrations/**/*{.ts,.js}'],
    migrationsTableName: 'migrations',
    // ── Pool configuration ──────────────────────────────────────────────────
    poolSize: pool.poolSize,
    // pg-specific extra options passed through TypeORM's `extra` field
    extra: {
      // Max idle time before a connection is released back to the OS.
      // Must be < RDS idle_client_timeout (600 s) to avoid stale connections.
      idleTimeoutMillis: pool.idleTimeoutMs,
      // Hard cap on how long a single statement may run (0 = disabled locally).
      statement_timeout: pool.statementTimeoutMs,
      // How long to wait for a new connection from the pool.
      connectionTimeoutMillis: pool.connectTimeoutMs,
      // SSL required for RDS; disabled locally.
      ssl: isProd ? { rejectUnauthorized: true } : false,
    },
  };
}

export const databaseConfig = registerAs('database', (): DataSourceOptions => {
  return buildDataSourceOptions();
});

/** TypeORM CLI + seed scripts — never use synchronize (migrations only). */
export const AppDataSource = new DataSource({
  ...buildDataSourceOptions(),
  synchronize: false,
});

export default AppDataSource;
