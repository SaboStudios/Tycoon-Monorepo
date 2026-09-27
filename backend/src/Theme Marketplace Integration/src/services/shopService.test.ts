import { ShopService } from './shopService';
import { db } from '../database';
import { PurchaseRequest } from '../types';

describe('ShopService', () => {
  let shopService: ShopService;

  beforeEach(() => {
    shopService = new ShopService();
    // Reset database
    db.seed();
  });

  describe('purchase', () => {
    it('should successfully purchase a single theme', async () => {
      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['skin-1'],
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction?.finalAmount).toBe(500);
      expect(result.unlockedThemes).toEqual(['skin-1']);
    });

    it('should successfully purchase multiple themes (bulk purchase)', async () => {
      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['skin-1', 'board-1'],
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(true);
      expect(result.transaction?.totalAmount).toBe(800);
      expect(result.unlockedThemes).toEqual(['skin-1', 'board-1']);
    });

    it('should apply percentage coupon correctly', async () => {
      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['skin-1'],
        couponCode: 'WELCOME20',
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(true);
      expect(result.transaction?.totalAmount).toBe(500);
      expect(result.transaction?.discountAmount).toBe(100);
      expect(result.transaction?.finalAmount).toBe(400);
    });

    it('should apply fixed discount coupon correctly', async () => {
      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['skin-1'],
        couponCode: 'SAVE100',
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(true);
      expect(result.transaction?.discountAmount).toBe(100);
      expect(result.transaction?.finalAmount).toBe(400);
    });

    it('should fail if user not found', async () => {
      const request: PurchaseRequest = {
        userId: 'invalid-user',
        themeIds: ['skin-1'],
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should fail if theme not found', async () => {
      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['invalid-theme'],
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('One or more themes not found');
    });

    it('should fail if no themes selected', async () => {
      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: [],
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No themes selected');
    });

    it('should fail if user already owns theme', async () => {
      // First purchase
      await shopService.purchase({
        userId: 'user-1',
        themeIds: ['skin-1'],
      });

      // Try to purchase again
      const result = await shopService.purchase({
        userId: 'user-1',
        themeIds: ['skin-1'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('You already own some of these themes');
    });

    it('should fail if insufficient balance', async () => {
      // Update user balance to low amount
      db.updateUser('user-1', { balance: 100 });

      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['skin-1'],
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient balance');
    });

    it('should fail if coupon is invalid', async () => {
      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['skin-1'],
        couponCode: 'INVALID',
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid coupon code');
    });

    it('should fail if coupon is expired', async () => {
      db.addCoupon({
        code: 'EXPIRED',
        discountType: 'percentage',
        discountValue: 10,
        expiresAt: new Date('2020-01-01'),
        usageLimit: 10,
        usedCount: 0,
        active: true,
      });

      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['skin-1'],
        couponCode: 'EXPIRED',
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Coupon has expired');
    });

    it('should fail if coupon usage limit reached', async () => {
      db.addCoupon({
        code: 'MAXED',
        discountType: 'percentage',
        discountValue: 10,
        expiresAt: new Date('2026-12-31'),
        usageLimit: 1,
        usedCount: 1,
        active: true,
      });

      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['skin-1'],
        couponCode: 'MAXED',
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Coupon usage limit reached');
    });

    it('should fail if coupon is not active', async () => {
      db.addCoupon({
        code: 'INACTIVE',
        discountType: 'percentage',
        discountValue: 10,
        expiresAt: new Date('2026-12-31'),
        usageLimit: 10,
        usedCount: 0,
        active: false,
      });

      const request: PurchaseRequest = {
        userId: 'user-1',
        themeIds: ['skin-1'],
        couponCode: 'INACTIVE',
      };

      const result = await shopService.purchase(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Coupon is not active');
    });

    it('should update user balance after purchase', async () => {
      const userBefore = db.getUser('user-1');
      const balanceBefore = userBefore!.balance;

      await shopService.purchase({
        userId: 'user-1',
        themeIds: ['skin-1'],
      });

      const userAfter = db.getUser('user-1');
      expect(userAfter!.balance).toBe(balanceBefore - 500);
    });

    it('should unlock themes instantly', async () => {
      const result = await shopService.purchase({
        userId: 'user-1',
        themeIds: ['skin-1', 'board-1'],
      });

      const user = db.getUser('user-1');
      expect(user!.ownedThemes).toContain('skin-1');
      expect(user!.ownedThemes).toContain('board-1');
      expect(result.success).toBe(true);
    });

    it('should create transaction log', async () => {
      const result = await shopService.purchase({
        userId: 'user-1',
        themeIds: ['skin-1'],
      });

      expect(result.transaction).toBeDefined();
      expect(result.transaction?.id).toBeDefined();
      expect(result.transaction?.userId).toBe('user-1');
      expect(result.transaction?.status).toBe('completed');
      expect(result.transaction?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getThemes', () => {
    it('should return all available themes', () => {
      const themes = shopService.getThemes();
      expect(themes.length).toBeGreaterThan(0);
      expect(themes.every((t) => t.available)).toBe(true);
    });

    it('should filter themes by type - skin', () => {
      const themes = shopService.getThemes('skin');
      expect(themes.every((t) => t.type === 'skin')).toBe(true);
    });

    it('should filter themes by type - board', () => {
      const themes = shopService.getThemes('board');
      expect(themes.every((t) => t.type === 'board')).toBe(true);
    });
  });

  describe('getUserTransactions', () => {
    it('should return user transactions', async () => {
      await shopService.purchase({
        userId: 'user-1',
        themeIds: ['skin-1'],
      });

      const transactions = shopService.getUserTransactions('user-1');
      expect(transactions.length).toBe(1);
      expect(transactions[0].userId).toBe('user-1');
    });

    it('should return empty array for user with no transactions', () => {
      const transactions = shopService.getUserTransactions('user-2');
      expect(transactions).toEqual([]);
    });
  });
});
