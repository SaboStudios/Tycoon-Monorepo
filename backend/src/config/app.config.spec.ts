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
  isValidOrigin,
  parseBoolean,
  parsePositiveInt,
  parseStepUpMethods,
} from './app.config';

// Keys touched across all suites – saved/restored around every test
const ALL_KEYS = [
  'CORS_ALLOWED_ORIGINS',
  'CORS_CREDENTIALS',
  'CORS_DEV_WILDCARD',
  'CORS_MAX_AGE',
  'DATA_EXPORT_DIR',
  'DATA_EXPORT_ENABLED',
  'DATA_EXPORT_ENQUEUE_TIMEOUT_MS',
  'DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS',
  'DATA_EXPORT_STEP_UP_METHODS',
  'DATA_EXPORT_TTL_HOURS',
  'NODE_ENV',
  'PORT',
] as const;

type EnvSnapshot = Record<(typeof ALL_KEYS)[number], string | undefined>;

function snapshotEnv(): EnvSnapshot {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, process.env[k]])) as EnvSnapshot;
}

function restoreEnv(snap: EnvSnapshot): void {
  for (const key of ALL_KEYS) {
    if (snap[key] === undefined) delete process.env[key];
    else process.env[key] = snap[key];
  }
}

// ---------------------------------------------------------------------------
// #1928 – parsePositiveInt
// ---------------------------------------------------------------------------
describe('parsePositiveInt', () => {
  it('returns the fallback when the raw value is undefined', () => {
    expect(parsePositiveInt('FOO', undefined, 24)).toBe(24);
  });

  it('returns the fallback when the raw value is an empty string', () => {
    expect(parsePositiveInt('FOO', '', 24)).toBe(24);
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
  it('parses a valid non-negative integer', () => {
    expect(parsePositiveInt('FOO', '48', 24)).toBe(48);
  });

  it('accepts zero without throwing', () => {
    expect(parsePositiveInt('DATA_EXPORT_ENQUEUE_TIMEOUT_MS', '0', 5000)).toBe(0);
  });

  it('throws when the value is not a finite number (NaN)', () => {
    expect(() => parsePositiveInt('DATA_EXPORT_TTL_HOURS', 'abc', 24)).toThrow(
      'DATA_EXPORT_TTL_HOURS',
    );
  });

  it('throws when the value is negative', () => {
    expect(() =>
      parsePositiveInt('DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS', '-1', 300),
    ).toThrow('DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS');
  });

  it('includes the env var name in the thrown error message', () => {
    expect(() => parsePositiveInt('DATA_EXPORT_TTL_HOURS', 'twentyfour', 24)).toThrow(
      /DATA_EXPORT_TTL_HOURS/,
    );
  });
});

// ---------------------------------------------------------------------------
// #1929 – parseBoolean
// ---------------------------------------------------------------------------
describe('parseBoolean', () => {
  it('returns the fallback when raw is undefined', () => {
    expect(parseBoolean('FLAG', undefined, true)).toBe(true);
    expect(parseBoolean('FLAG', undefined, false)).toBe(false);
  });

  it('returns the fallback when raw is an empty string', () => {
    expect(parseBoolean('FLAG', '', true)).toBe(true);
  });

  it.each([['true'], ['1'], ['yes'], ['TRUE'], ['YES']])(
    'treats %s as true',
    (val) => {
      expect(parseBoolean('FLAG', val, false)).toBe(true);
    },
  );

  it.each([['false'], ['0'], ['no'], ['FALSE'], ['No']])(
    'treats %s as false',
    (val) => {
      expect(parseBoolean('FLAG', val, true)).toBe(false);
    },
  );

  it('throws on an unrecognised value and includes the env var name', () => {
    expect(() => parseBoolean('DATA_EXPORT_ENABLED', 'maybe', true)).toThrow(
      /DATA_EXPORT_ENABLED/,
    );
    expect(() => parseBoolean('CORS_CREDENTIALS', '0x1', true)).toThrow(
      /CORS_CREDENTIALS/,
    );
  });
});

// ---------------------------------------------------------------------------
// #1930 – isValidOrigin
// ---------------------------------------------------------------------------
describe('isValidOrigin', () => {
  it.each([['http://localhost:3000'], ['https://app.example.com']])(
    'accepts valid origin: %s',
    (origin) => {
      expect(isValidOrigin(origin)).toBe(true);
    },
  );

  it.each([
    ['ftp://example.com'],
    ['file:///etc/passwd'],
    ['https://app.example.com/path'],
    ['https://app.example.com?q=1'],
    ['not-a-url'],
    [''],
  ])('rejects invalid origin: %s', (origin) => {
    expect(isValidOrigin(origin)).toBe(false);
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
// ---------------------------------------------------------------------------
// appConfig factory – integration across all four issues
// ---------------------------------------------------------------------------
describe('appConfig factory', () => {
  let snap: EnvSnapshot;

  beforeEach(() => {
    snap = snapshotEnv();
    for (const key of ALL_KEYS) delete process.env[key];
    // Ensure no NODE_ENV=production edge-case in these tests
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => restoreEnv(snap));

  // #1928 defaults
  it('returns documented numeric defaults when DATA_EXPORT_* vars are unset', () => {
    const cfg = appConfig();
    expect(cfg.dataExportTtlHours).toBe(24);
    expect(cfg.dataExportStepUpMaxAgeSeconds).toBe(300);
    expect(cfg.dataExportEnqueueTimeoutMs).toBe(5000);
  });

  it('throws on DATA_EXPORT_TTL_HOURS=abc', () => {
    process.env.DATA_EXPORT_TTL_HOURS = 'abc';
    expect(() => appConfig()).toThrow(/DATA_EXPORT_TTL_HOURS/);
  });

  it('throws on DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS=-1', () => {
    process.env.DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS = '-1';
    expect(() => appConfig()).toThrow(/DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS/);
  });

  it('accepts DATA_EXPORT_ENQUEUE_TIMEOUT_MS=0 without throwing', () => {
    process.env.DATA_EXPORT_ENQUEUE_TIMEOUT_MS = '0';
    expect(appConfig().dataExportEnqueueTimeoutMs).toBe(0);
  });

  // #1929 defaults and parsing
  it('returns documented boolean defaults when vars are unset', () => {
    const cfg = appConfig();
    expect(cfg.dataExportEnabled).toBe(true);
    expect(cfg.corsCredentials).toBe(true);
    expect(cfg.corsDevWildcard).toBe(true);
  });

  it.each([['false'], ['0'], ['no']])(
    'DATA_EXPORT_ENABLED=%s → false',
    (val) => {
      process.env.DATA_EXPORT_ENABLED = val;
      expect(appConfig().dataExportEnabled).toBe(false);
    },
  );

  it.each([['true'], ['1'], ['yes']])(
    'DATA_EXPORT_ENABLED=%s → true',
    (val) => {
      process.env.DATA_EXPORT_ENABLED = val;
      expect(appConfig().dataExportEnabled).toBe(true);
    },
  );

  it('throws when DATA_EXPORT_ENABLED=maybe', () => {
    process.env.DATA_EXPORT_ENABLED = 'maybe';
    expect(() => appConfig()).toThrow(/DATA_EXPORT_ENABLED/);
  });

  // #1930 – invalid CORS origin rejected at startup
  it('throws when CORS_ALLOWED_ORIGINS contains ftp://example.com', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'ftp://example.com';
    expect(() => appConfig()).toThrow(/ftp:\/\/example\.com/);
  });

  it('throws when CORS_ALLOWED_ORIGINS contains a URL with a path', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com/path';
    expect(() => appConfig()).toThrow(/https:\/\/app\.example\.com\/path/);
  });

  it('accepts valid http and https origins', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000,https://app.example.com';
    expect(() => appConfig()).not.toThrow();
  });

  // parseStepUpMethods still works
  it('throws for an unknown step-up method', () => {
    process.env.DATA_EXPORT_STEP_UP_METHODS = 'pwd,walet';
    expect(() => appConfig()).toThrow(/walet/);
  });
});

// ---------------------------------------------------------------------------
// parseStepUpMethods (pre-existing)
// ---------------------------------------------------------------------------
describe('parseStepUpMethods', () => {
  it('splits, trims and filters entries', () => {
    expect(parseStepUpMethods(' pwd , wallet , ')).toEqual(['pwd', 'wallet']);
  });

  it('throws for an unknown method', () => {
    expect(() => parseStepUpMethods('pwd,walet')).toThrow(/walet/);
  });

  it('throws when the resolved list is empty', () => {
    expect(() => parseStepUpMethods('')).toThrow(/at least one method/);
  });
});
