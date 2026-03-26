export const mockShopItems = [
  {
    id: 1,
    name: 'Speed Boost',
    description: 'Move 2 spaces forward',
    price: 100,
    rarity: 'common',
    type: 'boost',
    active: true,
    imageUrl: '/game/boost-speed.svg'
  },
  {
    id: 2,
    name: 'Get Out of Jail Free',
    description: 'Escape jail without paying',
    price: 500,
    rarity: 'rare',
    type: 'card',
    active: true,
    imageUrl: '/game/gotojail.svg'
  },
  {
    id: 3,
    name: 'Roll Again',
    description: 'Roll dice again',
    price: 200,
    rarity: 'common',
    type: 'boost',
    active: true
  }
];

export const mockInventory = [
  {
    id: 1,
    itemId: 1,
    quantity: 3,
    expiresAt: null
  },
  {
    id: 2,
    itemId: 2,
    quantity: 1,
    expiresAt: '2025-12-31T23:59:59Z'
  }
];

export const mockPurchase = {
  id: 99,
  userId: 1,
  itemId: 1,
  quantity: 1,
  totalPrice: 100,
  status: 'completed',
  createdAt: new Date().toISOString()
};
