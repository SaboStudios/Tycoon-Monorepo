import { shopService } from '../services/shopService';

describe('ShopService', () => {
  beforeEach(() => {
    shopService.clearAll();
  });

  describe('createItem', () => {
    it('should create a new item', () => {
      const item = shopService.createItem({
        name: 'Test Item',
        description: 'Test Description',
        price: 99.99,
        isActive: true,
        images: [],
      });

      expect(item).toHaveProperty('id');
      expect(item.name).toBe('Test Item');
      expect(item.price).toBe(99.99);
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('updatedAt');
    });
  });

  describe('getItems', () => {
    beforeEach(() => {
      shopService.createItem({
        name: 'Active Item',
        description: 'Active',
        price: 50,
        isActive: true,
        images: [],
      });
      shopService.createItem({
        name: 'Inactive Item',
        description: 'Inactive',
        price: 30,
        isActive: false,
        images: [],
      });
    });

    it('should get all items', () => {
      const items = shopService.getItems();
      expect(items).toHaveLength(2);
    });

    it('should get only active items', () => {
      const items = shopService.getItems(true);
      expect(items).toHaveLength(1);
      expect(items[0].isActive).toBe(true);
    });
  });

  describe('getItemById', () => {
    it('should get item by id', () => {
      const created = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const item = shopService.getItemById(created.id);
      expect(item).toBeDefined();
      expect(item?.id).toBe(created.id);
    });

    it('should return undefined for non-existent id', () => {
      const item = shopService.getItemById('999');
      expect(item).toBeUndefined();
    });
  });

  describe('updateItem', () => {
    it('should update item', () => {
      const created = shopService.createItem({
        name: 'Old Name',
        description: 'Old Description',
        price: 50,
        isActive: true,
        images: [],
      });

      const updated = shopService.updateItem(created.id, {
        name: 'New Name',
        price: 75,
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('New Name');
      expect(updated?.price).toBe(75);
      expect(updated?.description).toBe('Old Description');
    });

    it('should return null for non-existent item', () => {
      const updated = shopService.updateItem('999', { name: 'New Name' });
      expect(updated).toBeNull();
    });
  });

  describe('updatePrice', () => {
    it('should update price', () => {
      const created = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const updated = shopService.updatePrice(created.id, 99.99);
      expect(updated?.price).toBe(99.99);
    });
  });

  describe('toggleActive', () => {
    it('should toggle active status', () => {
      const created = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const updated = shopService.toggleActive(created.id, false);
      expect(updated?.isActive).toBe(false);
    });
  });

  describe('deleteItem', () => {
    it('should delete item', () => {
      const created = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const success = shopService.deleteItem(created.id);
      expect(success).toBe(true);

      const item = shopService.getItemById(created.id);
      expect(item).toBeUndefined();
    });

    it('should return false for non-existent item', () => {
      const success = shopService.deleteItem('999');
      expect(success).toBe(false);
    });
  });

  describe('bulkUpdate', () => {
    it('should bulk update multiple items', () => {
      const item1 = shopService.createItem({
        name: 'Item 1',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });
      const item2 = shopService.createItem({
        name: 'Item 2',
        description: 'Test',
        price: 60,
        isActive: true,
        images: [],
      });

      const updated = shopService.bulkUpdate([
        { id: item1.id, data: { price: 100 } },
        { id: item2.id, data: { price: 200, isActive: false } },
      ]);

      expect(updated).toHaveLength(2);
      expect(updated[0].price).toBe(100);
      expect(updated[1].price).toBe(200);
      expect(updated[1].isActive).toBe(false);
    });

    it('should skip non-existent items', () => {
      const item1 = shopService.createItem({
        name: 'Item 1',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const updated = shopService.bulkUpdate([
        { id: item1.id, data: { price: 100 } },
        { id: '999', data: { price: 200 } },
      ]);

      expect(updated).toHaveLength(1);
    });
  });
});
