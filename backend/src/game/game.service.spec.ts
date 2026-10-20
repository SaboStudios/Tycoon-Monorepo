import {
  RULESET_VERSION,
  DEFAULT_RULESET,
  serializeRuleset,
  computeRulesetHash,
  computePassGoBonus,
  computeJailFine,
  computeHouseCost,
  computeRent,
  isBankrupt,
} from './game.service';

describe('game.service pure rule helpers', () => {
  describe('computeRent', () => {
    const baseRent = 100;

    it('applies the base rent with no houses', () => {
      expect(computeRent(DEFAULT_RULESET, baseRent, 0)).toBe(baseRent);
    });

    it('applies the (1 + houses) multiplier at maxHousesPerProperty', () => {
      const houses = DEFAULT_RULESET.maxHousesPerProperty;
      expect(computeRent(DEFAULT_RULESET, baseRent, houses)).toBe(
        baseRent * (1 + houses),
      );
    });

    it('clamps houses above maxHousesPerProperty', () => {
      const max = DEFAULT_RULESET.maxHousesPerProperty;
      expect(computeRent(DEFAULT_RULESET, baseRent, max + 5)).toBe(
        baseRent * (1 + max),
      );
    });

    it('clamps negative houses to 0', () => {
      expect(computeRent(DEFAULT_RULESET, baseRent, -3)).toBe(baseRent);
    });
  });

  describe('computeHouseCost', () => {
    it('rounds baseHouseCost * houseCostMultiplier', () => {
      const ruleset = { ...DEFAULT_RULESET, houseCostMultiplier: 1.5 };
      expect(computeHouseCost(ruleset, 101)).toBe(Math.round(101 * 1.5));
    });

    it('returns the base cost when the multiplier is 1', () => {
      const ruleset = { ...DEFAULT_RULESET, houseCostMultiplier: 1 };
      expect(computeHouseCost(ruleset, 250)).toBe(250);
    });
  });

  describe('isBankrupt', () => {
    it('is true at exactly bankruptcyThreshold', () => {
      expect(isBankrupt(DEFAULT_RULESET, DEFAULT_RULESET.bankruptcyThreshold)).toBe(
        true,
      );
    });

    it('is false one unit above bankruptcyThreshold', () => {
      expect(
        isBankrupt(DEFAULT_RULESET, DEFAULT_RULESET.bankruptcyThreshold + 1),
      ).toBe(false);
    });
  });

  describe('computePassGoBonus / computeJailFine', () => {
    it('returns the ruleset passGoBonus', () => {
      expect(computePassGoBonus(DEFAULT_RULESET)).toBe(
        DEFAULT_RULESET.passGoBonus,
      );
    });

    it('returns the ruleset jailFine', () => {
      expect(computeJailFine(DEFAULT_RULESET)).toBe(DEFAULT_RULESET.jailFine);
    });
  });

  describe('serializeRuleset', () => {
    it('is key-order independent', () => {
      const a = { ...DEFAULT_RULESET };
      const b: typeof DEFAULT_RULESET = {} as typeof DEFAULT_RULESET;
      for (const key of Object.keys(DEFAULT_RULESET).reverse()) {
        (b as Record<string, unknown>)[key] = (
          DEFAULT_RULESET as Record<string, unknown>
        )[key];
      }
      expect(serializeRuleset(a)).toBe(serializeRuleset(b));
    });
  });

  describe('computeRulesetHash', () => {
    it('is deterministic and key-order independent', () => {
      const a = { ...DEFAULT_RULESET };
      const b: typeof DEFAULT_RULESET = {} as typeof DEFAULT_RULESET;
      for (const key of Object.keys(DEFAULT_RULESET).reverse()) {
        (b as Record<string, unknown>)[key] = (
          DEFAULT_RULESET as Record<string, unknown>
        )[key];
      }
      expect(computeRulesetHash(a)).toBe(computeRulesetHash(a));
      expect(computeRulesetHash(a)).toBe(computeRulesetHash(b));
    });

    it('changes when a ruleset field changes', () => {
      const changed = {
        ...DEFAULT_RULESET,
        bankruptcyThreshold: DEFAULT_RULESET.bankruptcyThreshold + 1,
      };
      expect(computeRulesetHash(changed)).not.toBe(
        computeRulesetHash(DEFAULT_RULESET),
      );
    });
  });

  describe('RULESET_VERSION', () => {
    it('is exposed as a non-empty string', () => {
      expect(typeof RULESET_VERSION).toBe('string');
      expect(RULESET_VERSION.length).toBeGreaterThan(0);
    });
  });
});
