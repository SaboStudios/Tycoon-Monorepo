import { DEFAULT_DB_PORT, resolveDbPort } from './db.config';

describe('resolveDbPort', () => {
  it('returns the default port when DB_PORT is unset', () => {
    expect(resolveDbPort({})).toBe(DEFAULT_DB_PORT);
    expect(resolveDbPort({})).toBe(5432);
  });

  it('returns the parsed integer for a valid value', () => {
    expect(resolveDbPort({ DB_PORT: '5433' })).toBe(5433);
  });

  it('throws a descriptive error for non-numeric input', () => {
    expect(() => resolveDbPort({ DB_PORT: 'abc' })).toThrow(/DB_PORT/);
  });

  it('throws for values outside the 1-65535 range', () => {
    expect(() => resolveDbPort({ DB_PORT: '0' })).toThrow(/DB_PORT/);
    expect(() => resolveDbPort({ DB_PORT: '70000' })).toThrow(/DB_PORT/);
  });
});
