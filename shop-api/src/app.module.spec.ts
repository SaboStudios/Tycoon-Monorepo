import { resolveSynchronize } from './app.module';

describe('resolveSynchronize', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDbSynchronize = process.env.DB_SYNCHRONIZE;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.NODE_ENV;
    delete process.env.DB_SYNCHRONIZE;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalDbSynchronize === undefined) {
      delete process.env.DB_SYNCHRONIZE;
    } else {
      process.env.DB_SYNCHRONIZE = originalDbSynchronize;
    }
  });

  it('returns true when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';

    expect(resolveSynchronize()).toBe(true);
  });

  it('throws when NODE_ENV is staging and DB_SYNCHRONIZE is true', () => {
    process.env.NODE_ENV = 'staging';
    process.env.DB_SYNCHRONIZE = 'true';

    expect(() => resolveSynchronize()).toThrow(/migration:run/);
  });

  it('returns false when NODE_ENV is staging without DB_SYNCHRONIZE', () => {
    process.env.NODE_ENV = 'staging';

    expect(resolveSynchronize()).toBe(false);
  });

  it('returns false when NODE_ENV is unset', () => {
    expect(resolveSynchronize()).toBe(false);
  });
});
