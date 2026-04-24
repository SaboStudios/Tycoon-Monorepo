import { shopService } from '../services/shopService';

describe('ShopService', () => {
  beforeEach(() => {
    shopService.clearAll();
  });

  // ---------------------------------------------------------------------------
  // createItem
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // getItems — basic filtering
  // ---------------------------------------------------------------------------

  describe('getItems — filtering', () => {
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

    it('should return all items by default', () => {
      const result = shopService.getItems();
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return only active items when activeOnly is true', () => {
      const result = shopService.getItems({ activeOnly: true });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].isActive).toBe(true);
      expect(result.total).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getItems — pagination
  // ---------------------------------------------------------------------------

  describe('getItems — pagination', () => {
    beforeEach(() => {
      // Create 5 items
      for (let i = 1; i <= 5; i++) {
        shopService.createItem({
          name: `Item ${i}`,
          description: 'Test',
          price: i * 10,
          isActive: true,
          images: [],
        });
      }
    });

    it('should return the first page with correct metadata', () => {
      const result = shopService.getItems({ page: 1, limit: 2 });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(3);
      expect(result.items).toHaveLength(2);
    });

    it('should return the last page (partial)', () => {
      const result = shopService.getItems({ page: 3, limit: 2 });

      expect(result.page).toBe(3);
      expect(result.items).toHaveLength(1); // 5 items, page 3 of 2-per-page = 1 item
    });

    it('should return an empty items array for a page beyond totalPages', () => {
      const result = shopService.getItems({ page: 99, limit: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(5);
    });

    it('should clamp limit to MAX_LIMIT (100)', () => {
      const result = shopService.getItems({ page: 1, limit: 9999 });

      expect(result.limit).toBe(100);
    });

    it('should default to page 1 and limit 20 when not specified', () => {
      const result = shopService.getItems();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('totalPages should be 1 when store is empty', () => {
      shopService.clearAll();
      const result = shopService.getItems();

      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getItems — sorting
  // ---------------------------------------------------------------------------

  describe('getItems — sorting', () => {
    beforeEach(() => {
      shopService.createItem({
        name: 'Zebra',
        description: 'Test',
        price: 30,
        isActive: true,
        images: [],
      });
      shopService.createItem({
        name: 'Apple',
        description: 'Test',
        price: 10,
        isActive: true,
        images: [],
      });
      shopService.createItem({
        name: 'Mango',
        description: 'Test',
        price: 20,
        isActive: true,
        images: [],
      });
    });

    it('should sort by name ascending', () => {
      const result = shopService.getItems({ sortBy: 'name', sortOrder: 'asc' });
      const names = result.items.map((i) => i.name);
      expect(names).toEqual(['Apple', 'Mango', 'Zebra']);
    });

    it('should sort by name descending', () => {
      const result = shopService.getItems({ sortBy: 'name', sortOrder: 'desc' });
      const names = result.items.map((i) => i.name);
      expect(names).toEqual(['Zebra', 'Mango', 'Apple']);
    });

    it('should sort by price ascending', () => {
      const result = shopService.getItems({ sortBy: 'price', sortOrder: 'asc' });
      const prices = result.items.map((i) => i.price);
      expect(prices).toEqual([10, 20, 30]);
    });

    it('should sort by price descending', () => {
      const result = shopService.getItems({ sortBy: 'price', sortOrder: 'desc' });
      const prices = result.items.map((i) => i.price);
      expect(prices).toEqual([30, 20, 10]);
    });

    it('should default to sorting by createdAt ascending', () => {
      const result = shopService.getItems();
      // Insertion order matches createdAt asc
      const names = result.items.map((i) => i.name);
      expect(names).toEqual(['Zebra', 'Apple', 'Mango']);
    });

    it('should produce a stable order for items with identical sort field values', () => {
      shopService.clearAll();
      // All items have the same price — stable sort must preserve id order
      const a = shopService.createItem({
        name: 'A', description: 'Test', price: 50, isActive: true, images: [],
      });
      const b = shopService.createItem({
        name: 'B', description: 'Test', price: 50, isActive: true, images: [],
      });
      const c = shopService.createItem({
        name: 'C', description: 'Test', price: 50, isActive: true, images: [],
      });

      const result = shopService.getItems({ sortBy: 'price', sortOrder: 'asc' });
      const ids = result.items.map((i) => i.id);
      expect(ids).toEqual([a.id, b.id, c.id]);
    });
  });

  // ---------------------------------------------------------------------------
  // getItemById
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // updateItem
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // updatePrice
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // toggleActive
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // deleteItem
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // bulkUpdate
  // ---------------------------------------------------------------------------

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