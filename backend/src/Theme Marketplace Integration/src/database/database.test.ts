import { Database } from './index';
import { User, Coupon, Transaction } from '../types';

describe('Database', () => {
  let db: Database;

  const makeUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-1',
    email: 'user1@example.com',
    name: 'User One',
    passwordHash: 'hash',
    role: 'customer',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  });

  const makeCoupon = (overrides: Partial<Coupon> = {}): Coupon => ({
    code: 'WELCOME20',
    discountPercent: 20,
    active: true,
    ...overrides,
  });

  beforeEach(() => {
    db = new Database();
  });

  describe('updateUser', () => {
    it('returns undefined for a missing id and does not create a row', () => {
      const result = db.updateUser('does-not-exist', { name: 'Ghost' });

      expect(result).toBeUndefined();
      expect(db.getUser('does-not-exist')).toBeUndefined();
    });

    it('merges updates and preserves untouched fields', () => {
      const user = makeUser();
      db.addUser(user);

      const updated = db.updateUser(user.id, { name: 'Renamed' });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Renamed');
      expect(updated!.email).toBe(user.email);
      expect(updated!.role).toBe(user.role);
      expect(updated!.createdAt).toEqual(user.createdAt);
      expect(db.getUser(user.id)!.name).toBe('Renamed');
    });
  });

  describe('coupons', () => {
    it('is case-insensitive for addCoupon and getCoupon', () => {
      db.addCoupon(makeCoupon({ code: 'welcome20' }));

      expect(db.getCoupon('WELCOME20')).toBeDefined();
      expect(db.getCoupon('welcome20')).toBeDefined();
      expect(db.getCoupon('WELCOME20')!.code).toBe('WELCOME20');
    });

    it('updateCoupon returns undefined for a missing code and does not create a row', () => {
      const result = db.updateCoupon('missing', { discountPercent: 50 });

      expect(result).toBeUndefined();
      expect(db.getCoupon('missing')).toBeUndefined();
    });

    it('updateCoupon merges updates and preserves untouched fields', () => {
      db.addCoupon(makeCoupon({ code: 'welcome20' }));

      const updated = db.updateCoupon('welcome20', { discountPercent: 30 });

      expect(updated).toBeDefined();
      expect(updated!.discountPercent).toBe(30);
      expect(updated!.active).toBe(true);
    });
  });

  describe('getUserTransactions', () => {
    it('filters transactions by userId', () => {
      const tx1: Transaction = {
        id: 'tx-1',
        userId: 'user-1',
        amount: 10,
        type: 'purchase',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      };
      const tx2: Transaction = {
        id: 'tx-2',
        userId: 'user-2',
        amount: 20,
        type: 'purchase',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
      };
      db.addTransaction(tx1);
      db.addTransaction(tx2);

      const result = db.getUserTransactions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tx-1');
    });
  });

  describe('clear', () => {
    it('empties all four maps', () => {
      db.addUser(makeUser());
      db.addCoupon(makeCoupon());
      db.addTransaction({
        id: 'tx-1',
        userId: 'user-1',
        amount: 10,
        type: 'purchase',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });

      db.clear();

      expect(db.getUser('user-1')).toBeUndefined();
      expect(db.getCoupon('WELCOME20')).toBeUndefined();
      expect(db.getUserTransactions('user-1')).toHaveLength(0);
    });
  });
});
