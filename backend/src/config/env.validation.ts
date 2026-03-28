import * as Joi from 'joi';

/**
 * Single source of truth for every environment variable the app reads.
 *
 * Rules:
 *  - Variables that are REQUIRED in production have no `.default()` and are
 *    conditionally required via `Joi.when('NODE_ENV', ...)`.
 *  - Dev-only defaults are set with `.default()` so local startup needs
 *    only a minimal .env.
 *  - No secret values are hardcoded here — defaults for secrets are only
 *    allowed in non-production environments.
 */

const isProd = Joi.valid('production', 'provision');

export const validationSchema = Joi.object({
  // ─── App ────────────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging', 'provision')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  API_DEFAULT_VERSION: Joi.string().default('1'),
  API_ENABLE_LEGACY_UNVERSIONED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  API_LEGACY_UNVERSIONED_SUNSET: Joi.string().isoDate().optional(),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  ENABLE_SWAGGER: Joi.boolean().truthy('true').falsy('false').default(false),

  // ─── Database ───────────────────────────────────────────────────────────────
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_POOL_SIZE: Joi.number().integer().min(1).max(100).optional(),
  DB_POOL_IDLE_TIMEOUT_MS: Joi.number().integer().min(0).optional(),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(0).optional(),
  DB_CONNECT_TIMEOUT_MS: Joi.number().integer().min(0).optional(),

  DB_SYNCHRONIZE: Joi.when('NODE_ENV', {
    is: isProd,
    then: Joi.valid(false, 'false', '0', 0).default(false),
    otherwise: Joi.boolean().truthy('true').falsy('false').default(false),
  }),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  // ─── JWT ────────────────────────────────────────────────────────────────────
  // In production JWT_SECRET MUST be explicitly set — no fallback allowed.
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: isProd,
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().default('dev-only-insecure-secret-change-me'),
  }),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  // Legacy alias kept for backward compat
  JWT_EXPIRATION_TIME: Joi.string().optional(),

  // ─── Redis ──────────────────────────────────────────────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),
  REDIS_TTL: Joi.number().default(300),

  // ─── Logging ────────────────────────────────────────────────────────────────
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .optional(),
  LOG_CONSOLE: Joi.boolean().truthy('true').falsy('false').default(false),

  // ─── Payment / Webhooks ─────────────────────────────────────────────────────
  PAYMENT_WEBHOOK_SECRET: Joi.when('NODE_ENV', {
    is: isProd,
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().allow('').optional(),
  }),

  // ─── Reconciliation ─────────────────────────────────────────────────────────
  RECONCILIATION_DRY_RUN: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  // ─── Data Export (Privacy module) ───────────────────────────────────────────
  DATA_EXPORT_DIR: Joi.string().default('./storage/data-exports'),
  DATA_EXPORT_TTL_HOURS: Joi.number().default(24),

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  // Must be < Kubernetes terminationGracePeriodSeconds (30 s).
  SHUTDOWN_TIMEOUT_MS: Joi.number().default(15000),

  // ─── Game defaults ──────────────────────────────────────────────────────────
  DEFAULT_AUCTION: Joi.boolean().truthy('true').falsy('false').default(true),
  DEFAULT_RENT_IN_PRISON: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  DEFAULT_MORTGAGE: Joi.boolean().truthy('true').falsy('false').default(true),
  DEFAULT_EVEN_BUILD: Joi.boolean().truthy('true').falsy('false').default(true),
  DEFAULT_RANDOMIZE_PLAY_ORDER: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  DEFAULT_STARTING_CASH: Joi.number().default(1500),
}).options({ allowUnknown: true }); // allow OS/CI vars without failing
