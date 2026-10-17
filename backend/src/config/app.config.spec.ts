import {
  appConfig,
  parseCorsOrigins,
  validateCorsOrigins,
  parsePort,
  requireNonBlank,
  parseStrictBoolean,
} from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;
    delete process.env.CORS_MAX_AGE;
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.API_PREFIX;
    delete process.env.API_DEFAULT_VERSION;
    delete process.env.TRUST_PROXY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ─── #1933: port / apiPrefix / defaultApiVersion validation ──────────────

  describe('parsePort (issue #1933)', () => {
    it('returns 3001 when PORT is unset', () => {
      expect(parsePort(undefined)).toBe(3001);
    });

    it('parses a valid port', () => {
      expect(parsePort('8080')).toBe(8080);
    });

    it('throws when PORT is non-numeric (e.g. "abc")', () => {
      expect(() => parsePort('abc')).toThrow(/PORT must be an integer/);
    });

    it('throws when PORT exceeds 65535', () => {
      expect(() => parsePort('70000')).toThrow(/PORT must be an integer/);
    });

    it('throws when PORT is 0', () => {
      expect(() => parsePort('0')).toThrow(/PORT must be an integer/);
    });

    it('throws when PORT is negative', () => {
      expect(() => parsePort('-1')).toThrow(/PORT must be an integer/);
    });
  });

  describe('requireNonBlank (issue #1933)', () => {
    it('returns the trimmed value when non-blank', () => {
      expect(requireNonBlank('  api  ', 'API_PREFIX')).toBe('api');
    });

    it('throws when value is an empty string', () => {
      expect(() => requireNonBlank('', 'API_DEFAULT_VERSION')).toThrow(
        /API_DEFAULT_VERSION/,
      );
    });

    it('throws when value is whitespace only', () => {
      expect(() => requireNonBlank('   ', 'API_PREFIX')).toThrow(/API_PREFIX/);
    });

    it('throws when value is undefined (no default provided)', () => {
      expect(() => requireNonBlank(undefined, 'API_PREFIX')).toThrow(/API_PREFIX/);
    });
  });

  describe('appConfig defaults for port / apiPrefix / defaultApiVersion (issue #1933)', () => {
    const loadConfig = () =>
      (appConfig as unknown as () => Record<string, unknown>)();

    it('returns port=3001, apiPrefix="api", defaultApiVersion="1" when vars are unset', () => {
      const cfg = loadConfig();
      expect(cfg.port).toBe(3001);
      expect(cfg.apiPrefix).toBe('api');
      expect(cfg.defaultApiVersion).toBe('1');
    });

    it('throws when PORT=abc', () => {
      process.env.PORT = 'abc';
      expect(loadConfig).toThrow(/PORT/);
    });

    it('throws when PORT=70000', () => {
      process.env.PORT = '70000';
      expect(loadConfig).toThrow(/PORT/);
    });

    it('throws when API_PREFIX is whitespace only', () => {
      process.env.API_PREFIX = '   ';
      expect(loadConfig).toThrow(/API_PREFIX/);
    });

    it('throws when API_DEFAULT_VERSION is empty', () => {
      process.env.API_DEFAULT_VERSION = '';
      expect(loadConfig).toThrow(/API_DEFAULT_VERSION/);
    });
  });

  // ─── #1932: trustProxy strict boolean validation ─────────────────────────

  describe('parseStrictBoolean (issue #1932)', () => {
    it('returns false when unset', () => {
      expect(parseStrictBoolean(undefined, 'TRUST_PROXY')).toBe(false);
    });

    it('returns false when empty string', () => {
      expect(parseStrictBoolean('', 'TRUST_PROXY')).toBe(false);
    });

    it.each(['true', 'TRUE', '1', 'yes'])('accepts truthy spelling "%s"', (val) => {
      expect(parseStrictBoolean(val, 'TRUST_PROXY')).toBe(true);
    });

    it.each(['false', 'FALSE', '0', 'no'])('accepts falsy spelling "%s"', (val) => {
      expect(parseStrictBoolean(val, 'TRUST_PROXY')).toBe(false);
    });

    it('throws with the variable name for an unrecognised value', () => {
      expect(() => parseStrictBoolean('maybe', 'TRUST_PROXY')).toThrow(
        /TRUST_PROXY/,
      );
    });
  });

  describe('appConfig trustProxy (issue #1932)', () => {
    const loadConfig = () =>
      (appConfig as unknown as () => Record<string, unknown>)();

    it('defaults to false when TRUST_PROXY is unset', () => {
      expect(loadConfig().trustProxy).toBe(false);
    });

    it.each(['true', 'TRUE', '1', 'yes'])(
      'trustProxy is true for TRUST_PROXY="%s"',
      (val) => {
        process.env.TRUST_PROXY = val;
        expect(loadConfig().trustProxy).toBe(true);
      },
    );

    it.each(['false', '0', 'no'])(
      'trustProxy is false for TRUST_PROXY="%s"',
      (val) => {
        process.env.TRUST_PROXY = val;
        expect(loadConfig().trustProxy).toBe(false);
      },
    );

    it('throws and includes "TRUST_PROXY" in the message for TRUST_PROXY="maybe"', () => {
      process.env.TRUST_PROXY = 'maybe';
      expect(loadConfig).toThrow(/TRUST_PROXY/);
    });
  });

  // ─── Existing: CORS origin configuration ──────────────────────────────────

  describe('CORS origin configuration', () => {
    describe('parseCorsOrigins', () => {
      it('splits comma-separated origins, trims whitespace and drops empty entries', () => {
        process.env.CORS_ALLOWED_ORIGINS =
          'https://app.example.com, https://admin.example.com ,, https://api.example.com ';

        expect(parseCorsOrigins()).toEqual([
          'https://app.example.com',
          'https://admin.example.com',
          'https://api.example.com',
        ]);
      });

      it('honours the legacy CORS_ORIGIN variable', () => {
        process.env.CORS_ORIGIN = 'https://legacy.example.com';

        expect(parseCorsOrigins()).toEqual(['https://legacy.example.com']);
      });

      it('prefers CORS_ALLOWED_ORIGINS over the legacy CORS_ORIGIN variable', () => {
        process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
        process.env.CORS_ORIGIN = 'https://legacy.example.com';

        expect(parseCorsOrigins()).toEqual(['https://app.example.com']);
      });

      it('falls back to the development default when nothing is configured', () => {
        process.env.NODE_ENV = 'development';

        expect(parseCorsOrigins()).toEqual(['http://localhost:3000']);
      });
    });

    describe('validateCorsOrigins', () => {
      it('throws in production when no origins are configured', () => {
        process.env.NODE_ENV = 'production';
        process.env.CORS_ALLOWED_ORIGINS = '';

        expect(() => validateCorsOrigins([])).toThrow();
      });

      it('throws for an invalid origin and names the offending origin', () => {
        expect(() => validateCorsOrigins(['not-a-valid-url'])).toThrow(
          /not-a-valid-url/,
        );
      });

      it('accepts valid origins', () => {
        expect(() =>
          validateCorsOrigins([
            'https://app.example.com',
            'https://admin.example.com',
          ]),
        ).not.toThrow();
      });
    });

    describe('CORS_MAX_AGE', () => {
      const loadConfig = () =>
        (appConfig as unknown as () => Record<string, unknown>)();

      it('throws when CORS_MAX_AGE is non-numeric', () => {
        process.env.CORS_MAX_AGE = 'abc';

        expect(loadConfig).toThrow('CORS_MAX_AGE must be a non-negative integer');
      });

      it('throws when CORS_MAX_AGE is negative', () => {
        process.env.CORS_MAX_AGE = '-1';

        expect(loadConfig).toThrow('CORS_MAX_AGE must be a non-negative integer');
      });

      it('returns the parsed value when CORS_MAX_AGE is a non-negative integer', () => {
        process.env.CORS_MAX_AGE = '3600';

        expect(loadConfig().corsMaxAge).toBe(3600);
      });
    });
  });

  // ─── Existing: data-export settings ───────────────────────────────────────

  describe('appConfig data-export settings', () => {
    const dataExportEnvKeys = [
      'DATA_EXPORT_DIR',
      'DATA_EXPORT_TTL_HOURS',
      'DATA_EXPORT_ENABLED',
      'DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS',
      'DATA_EXPORT_STEP_UP_METHODS',
      'DATA_EXPORT_ENQUEUE_TIMEOUT_MS',
    ];

    const savedExportEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      for (const key of dataExportEnvKeys) {
        savedExportEnv[key] = process.env[key];
        delete process.env[key];
      }
    });

    afterEach(() => {
      for (const key of dataExportEnvKeys) {
        if (savedExportEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = savedExportEnv[key];
        }
      }
    });

    const loadConfig = () =>
      (appConfig as unknown as () => Record<string, unknown>)();

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
});
