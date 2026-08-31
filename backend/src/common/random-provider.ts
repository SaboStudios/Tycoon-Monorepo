/**
 * RandomProvider — abstraction over RNG for deck draw operations.
 *
 * Production: SecureRandomProvider wraps crypto.randomInt (non-deterministic).
 * Tests:      SeededRandomProvider accepts a seed for fully deterministic draws.
 *
 * Inject `RANDOM_PROVIDER` token to override in tests:
 *   { provide: RANDOM_PROVIDER, useValue: new SeededRandomProvider(42) }
 */
import { secureRandomInt } from './crypto-secure-random';

export const RANDOM_PROVIDER = 'RANDOM_PROVIDER';

export interface RandomProvider {
  /** Returns a uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/** Default production implementation — cryptographically secure. */
export class SecureRandomProvider implements RandomProvider {
  nextInt(maxExclusive: number): number {
    return secureRandomInt(maxExclusive);
  }
}

/**
 * Deterministic LCG (Linear Congruential Generator) seeded with a known value.
 * Suitable only for unit tests — not cryptographically secure.
 *
 * @example
 *   const rng = new SeededRandomProvider(42);
 *   rng.nextInt(10); // always 0 for seed 42
 */
export class SeededRandomProvider implements RandomProvider {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0; // ensure 32-bit unsigned
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error('maxExclusive must be positive');
    // LCG params from Numerical Recipes
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state % maxExclusive;
  }
}
