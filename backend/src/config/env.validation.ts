import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  API_DEFAULT_VERSION: Joi.string().default('1'),
  API_ENABLE_LEGACY_UNVERSIONED: Joi.boolean().default(true),
  API_LEGACY_UNVERSIONED_SUNSET: Joi.string().isoDate().optional(),
  CORS_ORIGIN: Joi.string().required(),
  DATA_EXPORT_DIR: Joi.string().optional(),
  DATA_EXPORT_TTL_HOURS: Joi.number().optional(),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_POOL_SIZE: Joi.number().integer().min(1).max(100).optional(),
  DB_POOL_IDLE_TIMEOUT_MS: Joi.number().integer().min(0).optional(),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(0).optional(),
  DB_CONNECT_TIMEOUT_MS: Joi.number().integer().min(0).optional(),

  DB_SYNCHRONIZE: Joi.when('NODE_ENV', {
    is: Joi.valid('production', 'provision'),
    then: Joi.valid(false, 'false', '0', 0).default(false),
    otherwise: Joi.boolean().truthy('true').falsy('false').default(false),
  }),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),
  REDIS_TTL: Joi.number().default(300),

  // JWT (Required for future Auth)
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION_TIME: Joi.string().required(),
});
