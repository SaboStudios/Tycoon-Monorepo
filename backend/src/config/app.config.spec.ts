import {
  appConfig,
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
