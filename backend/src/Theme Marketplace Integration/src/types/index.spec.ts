import type {
  Theme,
  Coupon,
  Transaction,
  PurchaseResponse,
} from './index';

describe('Theme Marketplace Integration types', () => {
  describe('Theme.type', () => {
    it('accepts the allowed literal values', () => {
      const skinTheme = {
        id: 'theme-1',
        name: 'Neon Skin',
        type: 'skin',
        price: 4.99,
        description: 'A neon skin',
        available: true,
      } satisfies Theme;

      const boardTheme = {
        id: 'theme-2',
        name: 'Classic Board',
        type: 'board',
        price: 2.5,
        description: 'A classic board',
        available: false,
      } satisfies Theme;

      expect(skinTheme.type).toBe('skin');
      expect(boardTheme.type).toBe('board');
    });
  });

  describe('Coupon.discountType', () => {
    it('accepts the allowed literal values', () => {
      const percentageCoupon = {
        code: 'PCT10',
        discountType: 'percentage',
        discountValue: 10,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        usageLimit: 100,
        usedCount: 0,
        active: true,
      } satisfies Coupon;

      const fixedCoupon = {
        code: 'FIX5',
        discountType: 'fixed',
        discountValue: 5,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        usageLimit: 50,
        usedCount: 3,
        active: false,
      } satisfies Coupon;

      expect(percentageCoupon.discountType).toBe('percentage');
      expect(fixedCoupon.discountType).toBe('fixed');
    });
  });

  describe('Transaction.status', () => {
    it('accepts the allowed literal values', () => {
      const base = {
        id: 'txn-1',
        userId: 'user-1',
        themeIds: ['theme-1'],
        totalAmount: 4.99,
        discountAmount: 0,
        finalAmount: 4.99,
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
      };

      const completed = { ...base, status: 'completed' } satisfies Transaction;
      const failed = { ...base, status: 'failed' } satisfies Transaction;
      const pending = { ...base, status: 'pending' } satisfies Transaction;

      expect(completed.status).toBe('completed');
      expect(failed.status).toBe('failed');
      expect(pending.status).toBe('pending');
    });
  });

  describe('PurchaseResponse', () => {
    it('encodes a success response with transaction and unlockedThemes', () => {
      const transaction = {
        id: 'txn-1',
        userId: 'user-1',
        themeIds: ['theme-1'],
        totalAmount: 4.99,
        discountAmount: 0,
        finalAmount: 4.99,
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        status: 'completed',
      } satisfies Transaction;

      const success = {
        success: true,
        transaction,
        unlockedThemes: ['theme-1'],
      } satisfies PurchaseResponse;

      expect(success.success).toBe(true);
      expect(success.transaction).toBeDefined();
      expect(success.unlockedThemes).toEqual(['theme-1']);
      expect(success.error).toBeUndefined();
    });

    it('encodes a failure response with error and no transaction/unlockedThemes', () => {
      const failure = {
        success: false,
        error: 'Insufficient balance',
      } satisfies PurchaseResponse;

      expect(failure.success).toBe(false);
      expect(failure.error).toBe('Insufficient balance');
      expect(failure.transaction).toBeUndefined();
      expect(failure.unlockedThemes).toBeUndefined();
    });
  });
});
