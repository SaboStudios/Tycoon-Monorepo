import { parsePort } from './parsePort';

describe('parsePort', () => {
  it('accepts 3000', () => {
    expect(parsePort('3000')).toBe(3000);
  });

  it('throws for 0', () => {
    expect(() => parsePort('0')).toThrow();
  });

  it('throws for 65536', () => {
    expect(() => parsePort('65536')).toThrow();
  });

  it('throws for 3000.5', () => {
    expect(() => parsePort('3000.5')).toThrow();
  });
});
