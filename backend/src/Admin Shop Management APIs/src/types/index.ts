export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
}

export interface AuthRequest extends Express.Request {
  user?: User;
}
