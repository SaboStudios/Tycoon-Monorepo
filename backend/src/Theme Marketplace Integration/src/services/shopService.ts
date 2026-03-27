import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { PurchaseRequest, PurchaseResponse, Transaction } from '../types';

export class ShopService {
  async purchase(request: PurchaseRequest): Promise<PurchaseResponse> {
    const { userId, themeIds, couponCode } = request;

    // Validate user
    const user = db.getUser(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Validate themes
    if (!themeIds || themeIds.length === 0) {
      return { success: false, error: 'No themes selected' };
    }

    const themes = themeIds.map((id) => db.getThemeById(id)).filter(Boolean);
    if (themes.length !== themeIds.length) {
      return { success: false, error: 'One or more themes not found' };
    }

    // Check for unavailable themes
    const unavailable = themes.filter((t) => !t!.available);
    if (unavailable.length > 0) {
      return { success: false, error: 'Some themes are not available' };
    }

    // Check for already owned themes
    const alreadyOwned = themeIds.filter((id) => user.ownedThemes.includes(id));
    if (alreadyOwned.length > 0) {
      return { success: false, error: 'You already own some of these themes' };
    }

    // Calculate total
    const totalAmount = themes.reduce((sum, theme) => sum + theme!.price, 0);
    let discountAmount = 0;

    // Apply coupon if provided
    if (couponCode) {
      const coupon = db.getCoupon(couponCode);
      if (!coupon) {
        return { success: false, error: 'Invalid coupon code' };
      }

      if (!coupon.active) {
        return { success: false, error: 'Coupon is not active' };
      }

      if (new Date() > coupon.expiresAt) {
        return { success: false, error: 'Coupon has expired' };
      }

      if (coupon.usedCount >= coupon.usageLimit) {
        return { success: false, error: 'Coupon usage limit reached' };
      }

      // Calculate discount
      if (coupon.discountType === 'percentage') {
        discountAmount = Math.floor((totalAmount * coupon.discountValue) / 100);
      } else {
        discountAmount = Math.min(coupon.discountValue, totalAmount);
      }

      // Update coupon usage
      db.updateCoupon(couponCode, { usedCount: coupon.usedCount + 1 });
    }

    const finalAmount = totalAmount - discountAmount;

    // Check balance
    if (user.balance < finalAmount) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Create transaction
    const transaction: Transaction = {
      id: uuidv4(),
      userId,
      themeIds,
      totalAmount,
      discountAmount,
      finalAmount,
      couponCode,
      timestamp: new Date(),
      status: 'completed',
    };

    // Process purchase
    db.addTransaction(transaction);
    db.updateUser(userId, {
      balance: user.balance - finalAmount,
      ownedThemes: [...user.ownedThemes, ...themeIds],
    });

    return {
      success: true,
      transaction,
      unlockedThemes: themeIds,
    };
  }

  getThemes(type?: 'skin' | 'board'): any[] {
    const themes = db.getThemes();
    if (type) {
      return themes.filter((t) => t.type === type && t.available);
    }
    return themes.filter((t) => t.available);
  }

  getUserTransactions(userId: string): Transaction[] {
    return db.getUserTransactions(userId);
  }
}

export const shopService = new ShopService();
