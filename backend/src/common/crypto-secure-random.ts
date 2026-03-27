/**
 * Cryptographically secure random helpers (Node.js `crypto` module).
 * Use instead of Math.random() for IDs, sampling, and game outcomes.
 */
import { randomInt, randomBytes } from 'crypto';

/**
 * Uniform integer in [0, maxExclusive). Throws if maxExclusive <= 0.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    throw new Error('secureRandomInt: maxExclusive must be positive');
  }
  return randomInt(0, maxExclusive);
}

/**
 * Build a string of `length` by indexing into `alphabet` using secure random ints.
 */
export function secureRandomAlphaNumeric(length: number, alphabet: string): string {
  if (length <= 0 || alphabet.length < 2) {
    throw new Error('secureRandomAlphaNumeric: invalid length or alphabet');
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet.charAt(randomInt(0, alphabet.length));
  }
  return out;
}

/** Hex string from `randomBytes` (e.g. for opaque suffixes). */
export function secureRandomHex(byteLength: number): string {
  return randomBytes(byteLength).toString('hex');
}
