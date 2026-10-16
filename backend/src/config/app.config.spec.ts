import { appConfig } from './app.config';

describe('appConfig data-export settings', () => {
  const dataExportEnvKeys = [
    'DATA_EXPORT_DIR',
    'DATA_EXPORT_TTL_HOURS',
    'DATA_EXPORT_ENABLED',
    'DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS',
    'DATA_EXPORT_STEP_UP_METHODS',
    'DATA_EXPORT_ENQUEUE_TIMEOUT_MS',
  ];

  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of dataExportEnvKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of dataExportEnvKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  const loadConfig = () => (appConfig as unknown as () => Record<string, unknown>)();

  it('applies documented defaults when DATA_EXPORT_* vars are unset', () => {
    const config = loadConfig();

    expect(config.dataExportDir).toBe('./storage/data-exports');
    expect(config.dataExportTtlHours).toBe(24);
    expect(config.dataExportEnabled).toBe(true);
    expect(config.dataExportStepUpMaxAgeSeconds).toBe(300);
    expect(config.dataExportStepUpMethods).toEqual(['pwd', 'wallet']);
    expect(config.dataExportEnqueueTimeoutMs).toBe(5000);
  });

  it('disables data export when DATA_EXPORT_ENABLED=false', () => {
    process.env.DATA_EXPORT_ENABLED = 'false';

    expect(loadConfig().dataExportEnabled).toBe(false);
  });

  it('splits, trims and filters DATA_EXPORT_STEP_UP_METHODS', () => {
    process.env.DATA_EXPORT_STEP_UP_METHODS = 'pwd, wallet ,,otp';

    expect(loadConfig().dataExportStepUpMethods).toEqual(['pwd', 'wallet', 'otp']);
  });

  it('parses DATA_EXPORT_TTL_HOURS and DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS as numbers', () => {
    process.env.DATA_EXPORT_TTL_HOURS = '48';
    process.env.DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS = '600';

    const config = loadConfig();

    expect(config.dataExportTtlHours).toBe(48);
    expect(config.dataExportStepUpMaxAgeSeconds).toBe(600);
  });
});
