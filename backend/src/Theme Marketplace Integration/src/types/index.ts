export interface Theme {
  id: string;
  name: string;
  type: 'skin' | 'board';
  price: number;
  description: string;
  imageUrl?: string;
  available: boolean;
}

export interface User {
  id: string;
  username: string;
  ownedThemes: string[];
  balance: number;
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  expiresAt: Date;
  usageLimit: number;
  usedCount: number;
  active: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  themeIds: string[];
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode?: string;
  timestamp: Date;
  status: 'completed' | 'failed' | 'pending';
}

export interface PurchaseRequest {
  userId: string;
  themeIds: string[];
  couponCode?: string;
}

export interface PurchaseResponse {
  success: boolean;
  transaction?: Transaction;
  unlockedThemes?: string[];
  error?: string;
}
