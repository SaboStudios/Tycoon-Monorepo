import * as Joi from 'joi';

/**
 * Joi schema describing every environment variable read by shop-api.
 *
 * Wired into `ConfigModule.forRoot` in `app.module.ts` with
 * `validationOptions: { abortEarly: false }` so that a misconfigured
 * deployment fails fast at boot and reports *all* missing/invalid vars
 * at once (matching the backend's `env.validation.ts` behaviour).
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  DB_SYNCHRONIZE: Joi.boolean().default(false),
});
