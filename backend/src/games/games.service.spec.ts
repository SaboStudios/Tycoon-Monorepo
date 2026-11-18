import {
  TRADE_RULESET,
  TRADE_RULESET_VERSION,
  isTradeOfferExpired,
  validateTradeOffer,
  applyTradeCashTransfer,
  acceptTradeOffer,
} from './games.service';

describe('trade offer ruleset helpers', () => {
  const baseOffer = {
    status: 'PENDING',
    cashAmount: 100,
    propertyIds: ['a', 'b'],
  };

  describe('isTradeOfferExpired', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');

    it('is true at exactly offerTtlMs', () => {
      const now = new Date(createdAt.getTime() + TRADE_RULESET.offerTtlMs);
      expect(
        isTradeOfferExpired({ ...baseOffer, createdAt }, now, TRADE_RULESET),
      ).toBe(true);
    });

    it('is false one millisecond before offerTtlMs', () => {
      const now = new Date(createdAt.getTime() + TRADE_RULESET.offerTtlMs - 1);
      expect(
        isTradeOfferExpired({ ...baseOffer, createdAt }, now, TRADE_RULESET),
      ).toBe(false);
    });

    it('returns false for a non-PENDING offer regardless of age', () => {
      const now = new Date(createdAt.getTime() + TRADE_RULESET.offerTtlMs * 10);
      for (const status of ['ACCEPTED', 'DECLINED', 'CANCELLED']) {
        expect(
          isTradeOfferExpired(
            { ...baseOffer, status, createdAt },
            now,
            TRADE_RULESET,
          ),
        ).toBe(false);
      }
    });

    it('accepts createdAt as an ISO string', () => {
      const now = new Date(createdAt.getTime() + TRADE_RULESET.offerTtlMs);
      expect(
        isTradeOfferExpired(
          { ...baseOffer, createdAt: createdAt.toISOString() },
          now,
          TRADE_RULESET,
        ),
      ).toBe(true);
    });
  });

  describe('validateTradeOffer', () => {
    it('returns null for a valid payload', () => {
      expect(validateTradeOffer(baseOffer, TRADE_RULESET)).toBeNull();
    });

    it('rejects a non-integer cashAmount', () => {
      expect(
        validateTradeOffer({ ...baseOffer, cashAmount: 1.5 }, TRADE_RULESET),
      ).toBe('cashAmount must be a non-negative integer');
    });

    it('rejects a negative cashAmount', () => {
      expect(
        validateTradeOffer({ ...baseOffer, cashAmount: -1 }, TRADE_RULESET),
      ).toBe('cashAmount must be a non-negative integer');
    });

    it('rejects a cashAmount above maxCashAmount', () => {
      expect(
        validateTradeOffer(
          { ...baseOffer, cashAmount: TRADE_RULESET.maxCashAmount + 1 },
          TRADE_RULESET,
        ),
      ).toBe(`cashAmount must not exceed ${TRADE_RULESET.maxCashAmount}`);
    });

    it('rejects non-array propertyIds', () => {
      expect(
        validateTradeOffer(
          { ...baseOffer, propertyIds: 'a' as unknown as string[] },
          TRADE_RULESET,
        ),
      ).toBe('propertyIds must be an array');
    });

    it('rejects duplicate propertyIds', () => {
      expect(
        validateTradeOffer(
          { ...baseOffer, propertyIds: ['a', 'a'] },
          TRADE_RULESET,
        ),
      ).toBe('propertyIds must not contain duplicates');
    });
  });

  describe('applyTradeCashTransfer', () => {
    it('debits and credits the same integer amount for a 10-unit trade', () => {
      const result = applyTradeCashTransfer(100, 50, 10);
      expect(result.fromCash).toBe(90);
      expect(result.toCash).toBe(60);
      expect(result.amount).toBe(10);
      expect(Number.isInteger(result.amount)).toBe(true);
      expect(100 - result.fromCash).toBe(result.toCash - 50);
    });

    it('throws and leaves balances untouched when cash is insufficient', () => {
      expect(() => applyTradeCashTransfer(5, 50, 10)).toThrow();
    });

    it('rejects a non-integer amount', () => {
      expect(() => applyTradeCashTransfer(100, 50, 1.5)).toThrow();
    });
  });

  it('exposes a ruleset version', () => {
    expect(typeof TRADE_RULESET_VERSION).toBe('string');
  });
});

describe('acceptTradeOffer recipient authorization', () => {
  const recipientId = 'player-recipient';
  const thirdPlayerId = 'player-third';

  const makeOffer = (status: string) => ({
    id: 'offer-1',
    status,
    toPlayerId: recipientId,
    fromPlayerId: 'player-sender',
    cashAmount: 100,
    propertyIds: ['a', 'b'],
  });

  it('returns the stored accepted offer to the recipient on retry', () => {
    const offer = makeOffer('ACCEPTED');
    const result = acceptTradeOffer(offer, recipientId);
    expect(result).toBe(offer);
  });

  it('rejects a third player reading an accepted offer with 403', () => {
    const offer = makeOffer('ACCEPTED');
    expect(() => acceptTradeOffer(offer, thirdPlayerId)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('rejects a third player reading a pending offer with 403', () => {
    const offer = makeOffer('PENDING');
    expect(() => acceptTradeOffer(offer, thirdPlayerId)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
