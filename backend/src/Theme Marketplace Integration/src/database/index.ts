import { Theme, User, Coupon, Transaction } from '../types';

class Database {
  private themes: Map<string, Theme> = new Map();
  private users: Map<string, User> = new Map();
  private coupons: Map<string, Coupon> = new Map();
  private transactions: Map<string, Transaction> = new Map();

  // Theme operations
  getThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  getThemeById(id: string): Theme | undefined {
    return this.themes.get(id);
  }

  addTheme(theme: Theme): void {
    this.themes.set(theme.id, theme);
  }

  // User operations
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  updateUser(userId: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const updated = { ...user, ...updates };
    this.users.set(userId, updated);
    return updated;
  }

  // Coupon operations
  getCoupon(code: string): Coupon | undefined {
    return this.coupons.get(code.toUpperCase());
  }

  addCoupon(coupon: Coupon): void {
    this.coupons.set(coupon.code.toUpperCase(), coupon);
  }

  updateCoupon(code: string, updates: Partial<Coupon>): Coupon | undefined {
    const coupon = this.coupons.get(code.toUpperCase());
    if (!coupon) return undefined;

    const updated = { ...coupon, ...updates };
    this.coupons.set(code.toUpperCase(), updated);
    return updated;
  }

  // Transaction operations
  addTransaction(transaction: Transaction): void {
    this.transactions.set(transaction.id, transaction);
  }

  getTransaction(id: string): Transaction | undefined {
    return this.transactions.get(id);
  }

  getUserTransactions(userId: string): Transaction[] {
    return Array.from(this.transactions.values()).filter(
      (t) => t.userId === userId,
    );
  }

  getAllTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }

  // Clear all data
  clear(): void {
    this.themes.clear();
    this.users.clear();
    this.coupons.clear();
    this.transactions.clear();
  }

  // Seed data
  seed(): void {
    // Clear existing data first
    this.clear();
    // Add sample themes
    this.addTheme({
      id: 'skin-1',
      name: 'Dragon Warrior',
      type: 'skin',
      price: 500,
      description: 'Epic dragon-themed skin',
      available: true,
    });

    this.addTheme({
      id: 'skin-2',
      name: 'Cyber Ninja',
      type: 'skin',
      price: 750,
      description: 'Futuristic cyber ninja skin',
      available: true,
    });

    this.addTheme({
      id: 'board-1',
      name: 'Galaxy Board',
      type: 'board',
      price: 300,
      description: 'Space-themed board style',
      available: true,
    });

    this.addTheme({
      id: 'board-2',
      name: 'Neon Lights',
      type: 'board',
      price: 400,
      description: 'Vibrant neon board style',
      available: true,
    });

    // Add sample user
    this.addUser({
      id: 'user-1',
      username: 'testuser',
      ownedThemes: [],
      balance: 10000,
    });

    // Add sample coupons
    this.addCoupon({
      code: 'WELCOME20',
      discountType: 'percentage',
      discountValue: 20,
      expiresAt: new Date('2026-12-31'),
      usageLimit: 100,
      usedCount: 0,
      active: true,
    });

    this.addCoupon({
      code: 'SAVE100',
      discountType: 'fixed',
      discountValue: 100,
      expiresAt: new Date('2026-12-31'),
      usageLimit: 50,
      usedCount: 0,
      active: true,
    });
  }
}

export const db = new Database();
db.seed();
