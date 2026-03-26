jest.mock('crypto', () => ({
  randomInt: jest.fn(),
  randomBytes: jest.fn(),
}));

import { randomInt, randomBytes } from 'crypto';
import {
  secureRandomInt,
  secureRandomAlphaNumeric,
  secureRandomHex,
} from './crypto-secure-random';

describe('crypto-secure-random', () => {
  const mockRandomInt = randomInt as jest.MockedFunction<typeof randomInt>;
  const mockRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('secureRandomInt', () => {
    it('throws when maxExclusive is not positive', () => {
      expect(() => secureRandomInt(0)).toThrow();
      expect(() => secureRandomInt(-1)).toThrow();
    });

    it('delegates to crypto.randomInt(0, maxExclusive) — deterministic under mock', () => {
      mockRandomInt.mockReturnValue(7 as never);
      expect(secureRandomInt(100)).toBe(7);
      expect(mockRandomInt).toHaveBeenCalledWith(0, 100);
    });
  });

  describe('secureRandomAlphaNumeric', () => {
    it('throws on invalid args', () => {
      expect(() => secureRandomAlphaNumeric(0, 'AB')).toThrow();
      expect(() => secureRandomAlphaNumeric(3, 'A')).toThrow();
    });

    it('builds string from repeated randomInt calls', () => {
      mockRandomInt
        .mockReturnValueOnce(0 as never)
        .mockReturnValueOnce(1 as never)
        .mockReturnValueOnce(2 as never);
      expect(secureRandomAlphaNumeric(3, 'ABC')).toBe('ABC');
    });
  });

  describe('secureRandomHex', () => {
    it('returns hex from randomBytes', () => {
      mockRandomBytes.mockReturnValue(
        Buffer.from([0xde, 0xad, 0xbe, 0xef]) as never,
      );
      expect(secureRandomHex(4)).toBe('deadbeef');
      expect(mockRandomBytes).toHaveBeenCalledWith(4);
    });
  });
});
