import { ShopItem } from '../types';

// In-memory storage (replace with database in production)
let shopItems: ShopItem[] = [];
let itemIdCounter = 1;

export const shopService = {
  createItem: (
    data: Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>,
  ): ShopItem => {
    const newItem: ShopItem = {
      ...data,
      id: String(itemIdCounter++),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    shopItems.push(newItem);
    return newItem;
  },

  getItems: (activeOnly: boolean = false): ShopItem[] => {
    return activeOnly ? shopItems.filter((item) => item.isActive) : shopItems;
  },

  getItemById: (id: string): ShopItem | undefined => {
    return shopItems.find((item) => item.id === id);
  },

  updateItem: (
    id: string,
    data: Partial<Omit<ShopItem, 'id' | 'createdAt'>>,
  ): ShopItem | null => {
    const index = shopItems.findIndex((item) => item.id === id);
    if (index === -1) return null;

    shopItems[index] = {
      ...shopItems[index],
      ...data,
      updatedAt: new Date(),
    };
    return shopItems[index];
  },

  updatePrice: (id: string, price: number): ShopItem | null => {
    return shopService.updateItem(id, { price });
  },

  toggleActive: (id: string, isActive: boolean): ShopItem | null => {
    return shopService.updateItem(id, { isActive });
  },

  deleteItem: (id: string): boolean => {
    const index = shopItems.findIndex((item) => item.id === id);
    if (index === -1) return false;
    shopItems.splice(index, 1);
    return true;
  },

  bulkUpdate: (
    updates: Array<{
      id: string;
      data: Partial<Omit<ShopItem, 'id' | 'createdAt'>>;
    }>,
  ): ShopItem[] => {
    const updatedItems: ShopItem[] = [];

    updates.forEach(({ id, data }) => {
      const updated = shopService.updateItem(id, data);
      if (updated) updatedItems.push(updated);
    });

    return updatedItems;
  },

  // For testing purposes
  clearAll: () => {
    shopItems = [];
    itemIdCounter = 1;
  },
};
