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

  // File uploads
  UPLOAD_MAX_FILE_SIZE_MB: Joi.number().default(5),
  UPLOAD_ALLOWED_MIME_TYPES: Joi.string().optional(),
  UPLOAD_DIR: Joi.string().optional(),
  AWS_S3_BUCKET: Joi.string().optional(),
  AWS_REGION: Joi.string().optional(),
  AWS_S3_ENDPOINT: Joi.string().optional(),
  SIGNED_URL_TTL_SECONDS: Joi.number().optional(),
  CLAMAV_HOST: Joi.string().optional(),
  CLAMAV_PORT: Joi.number().optional(),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
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
