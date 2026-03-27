import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  defaultApiVersion: process.env.API_DEFAULT_VERSION || '1',
  enableLegacyUnversionedRoutes:
    process.env.API_ENABLE_LEGACY_UNVERSIONED !== 'false',
  legacyUnversionedSunset: process.env.API_LEGACY_UNVERSIONED_SUNSET,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  /** Directory for async JSON user data exports (see privacy module). */
  dataExportDir: process.env.DATA_EXPORT_DIR || './storage/data-exports',
  dataExportTtlHours: parseInt(process.env.DATA_EXPORT_TTL_HOURS || '24', 10),
}));
