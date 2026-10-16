import { resolveSynchronize } from '../app.module';

describe('resolveSynchronize', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDbSynchronize = process.env.DB_SYNCHRONIZE;

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
    delete process.env.DB_SYNCHRONIZE;

    expect(resolveSynchronize()).toBe(true);
  });

  it('throws when NODE_ENV contains staging and DB_SYNCHRONIZE is true', () => {
    process.env.NODE_ENV = 'staging';
    process.env.DB_SYNCHRONIZE = 'true';

    expect(() => resolveSynchronize()).toThrow(
      'DB_SYNCHRONIZE must not be enabled in staging environments',
    );
  });

  it('returns false when NODE_ENV contains staging without DB_SYNCHRONIZE', () => {
    process.env.NODE_ENV = 'staging';
    delete process.env.DB_SYNCHRONIZE;

    expect(resolveSynchronize()).toBe(false);
  });

  it('returns false for a default environment', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DB_SYNCHRONIZE;

    expect(resolveSynchronize()).toBe(false);
  });
});
