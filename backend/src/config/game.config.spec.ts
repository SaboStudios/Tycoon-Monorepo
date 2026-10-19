import { gameConfig } from './game.config';

const ENV_KEYS = [
  'DEFAULT_AUCTION',
  'DEFAULT_RENT_IN_PRISON',
  'DEFAULT_MORTGAGE',
  'DEFAULT_EVEN_BUILD',
  'DEFAULT_RANDOMIZE_PLAY_ORDER',
  'DEFAULT_STARTING_CASH',
  'GAMES_CHAT_ENABLED',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const originalEnv: Record<EnvKey, string | undefined> = {} as Record<
  EnvKey,
  string | undefined
>;

beforeAll(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
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

function loadConfig(env: Partial<Record<EnvKey, string>> = {}) {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  return gameConfig();
}

describe('gameConfig', () => {
  describe('startingCash', () => {
    it('defaults to 1500 when DEFAULT_STARTING_CASH is unset', () => {
      expect(loadConfig().defaultSettings.startingCash).toBe(1500);
    });

    it('parses a numeric DEFAULT_STARTING_CASH', () => {
      expect(
        loadConfig({ DEFAULT_STARTING_CASH: '2500' }).defaultSettings
          .startingCash,
      ).toBe(2500);
    });

    it('never yields NaN for a non-numeric DEFAULT_STARTING_CASH', () => {
      const startingCash = loadConfig({ DEFAULT_STARTING_CASH: 'abc' })
        .defaultSettings.startingCash;
      expect(Number.isNaN(startingCash)).toBe(false);
      expect(startingCash).toBe(1500);
    });

    it('never yields NaN for a partially numeric DEFAULT_STARTING_CASH', () => {
      const startingCash = loadConfig({ DEFAULT_STARTING_CASH: '1500abc' })
        .defaultSettings.startingCash;
      expect(Number.isNaN(startingCash)).toBe(false);
      expect(startingCash).toBe(1500);
    });
  });

  describe('boolean flags defaulting to true', () => {
    const trueByDefault: Array<{
      env: EnvKey;
      key: keyof ReturnType<typeof gameConfig>['defaultSettings'];
    }> = [
      { env: 'DEFAULT_AUCTION', key: 'auction' },
      { env: 'DEFAULT_MORTGAGE', key: 'mortgage' },
      { env: 'DEFAULT_EVEN_BUILD', key: 'evenBuild' },
      { env: 'DEFAULT_RANDOMIZE_PLAY_ORDER', key: 'randomizePlayOrder' },
    ];

    it.each(trueByDefault)('$env defaults to true when unset', ({ env, key }) => {
      expect(loadConfig().defaultSettings[key]).toBe(true);
    });

    it.each(trueByDefault)('$env is true when set to "true"', ({ env, key }) => {
      expect(loadConfig({ [env]: 'true' }).defaultSettings[key]).toBe(true);
    });

    it.each(trueByDefault)('$env is false when set to "false"', ({ env, key }) => {
      expect(loadConfig({ [env]: 'false' }).defaultSettings[key]).toBe(false);
    });
  });

  describe('boolean flags defaulting to false', () => {
    it('rentInPrison defaults to false when unset', () => {
      expect(loadConfig().defaultSettings.rentInPrison).toBe(false);
    });

    it('rentInPrison is true when DEFAULT_RENT_IN_PRISON is "true"', () => {
      expect(
        loadConfig({ DEFAULT_RENT_IN_PRISON: 'true' }).defaultSettings
          .rentInPrison,
      ).toBe(true);
    });

    it('rentInPrison is false when DEFAULT_RENT_IN_PRISON is "false"', () => {
      expect(
        loadConfig({ DEFAULT_RENT_IN_PRISON: 'false' }).defaultSettings
          .rentInPrison,
      ).toBe(false);
    });

    it('chatEnabled defaults to false when unset', () => {
      expect(loadConfig().chatEnabled).toBe(false);
    });

    it('chatEnabled is true when GAMES_CHAT_ENABLED is "true"', () => {
      expect(loadConfig({ GAMES_CHAT_ENABLED: 'true' }).chatEnabled).toBe(
        true,
      );
    });

    it('chatEnabled is false when GAMES_CHAT_ENABLED is "false"', () => {
      expect(loadConfig({ GAMES_CHAT_ENABLED: 'false' }).chatEnabled).toBe(
        false,
      );
    });
  });
});
