import appConfig, { parseStepUpMethods } from './app.config';

const ENV_KEYS = [
  'DATA_EXPORT_DIR',
  'DATA_EXPORT_TTL_HOURS',
  'DATA_EXPORT_ENABLED',
  'DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS',
  'DATA_EXPORT_STEP_UP_METHODS',
  'DATA_EXPORT_ENQUEUE_TIMEOUT_MS',
] as const;

describe('app config', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  describe('dataExport defaults', () => {
    it('exposes the documented default values', () => {
      const config = appConfig();

      expect(config.dataExportDir).toBe('./storage/data-exports');
      expect(config.dataExportTtlHours).toBe(24);
      expect(config.dataExportEnabled).toBe(true);
      expect(config.dataExportStepUpMaxAgeSeconds).toBe(300);
      expect(config.dataExportStepUpMethods).toEqual(['pwd', 'wallet']);
      expect(config.dataExportEnqueueTimeoutMs).toBe(5000);
    });
  });

  describe('parseStepUpMethods', () => {
    it('splits, trims and filters entries', () => {
      expect(parseStepUpMethods(' pwd , wallet , ')).toEqual([
        'pwd',
        'wallet',
      ]);
    });

    it('throws when an entry is outside the allowlist', () => {
      expect(() => parseStepUpMethods('pwd,walet')).toThrow(/walet/);
    });

    it('throws when the resolved list is empty', () => {
      expect(() => parseStepUpMethods('')).toThrow(
        /at least one method/,
      );
      expect(() => parseStepUpMethods(' , , ')).toThrow(
        /at least one method/,
      );
    });
  });

  describe('factory validation', () => {
    it('throws at startup for an unknown step-up method', () => {
      process.env.DATA_EXPORT_STEP_UP_METHODS = 'pwd,walet';

      expect(() => appConfig()).toThrow(/walet/);
    });

    it('throws at startup when the step-up list is empty', () => {
      process.env.DATA_EXPORT_STEP_UP_METHODS = '';

      expect(() => appConfig()).toThrow(/at least one method/);
    });
  });
});
