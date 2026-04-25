import { ShopItem } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortableField = 'name' | 'price' | 'createdAt' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

export interface GetItemsOptions {
  /** Return only active items. Defaults to false (all items). */
  activeOnly?: boolean;
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Items per page (1-100). Defaults to 20. */
  limit?: number;
  /** Field to sort by. Defaults to 'createdAt'. */
  sortBy?: SortableField;
  /** Sort direction. Defaults to 'asc'. */
  sortOrder?: SortOrder;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// In-memory storage (replace with database in production)
// ---------------------------------------------------------------------------

let shopItems: ShopItem[] = [];
let itemIdCounter = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stable comparator: sorts by `sortBy` field first, then by numeric `id` as
 * a tiebreaker so identical field values always produce the same order.
 */
function buildComparator(
  sortBy: SortableField,
  sortOrder: SortOrder,
): (a: ShopItem, b: ShopItem) => number {
  const direction = sortOrder === 'asc' ? 1 : -1;

  return (a: ShopItem, b: ShopItem): number => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    let primary = 0;

    if (aVal instanceof Date && bVal instanceof Date) {
      primary = aVal.getTime() - bVal.getTime();
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      primary = aVal - bVal;
    } else {
      primary = String(aVal).localeCompare(String(bVal));
    }

    if (primary !== 0) return primary * direction;

    // Stable tiebreaker: ascending numeric id (insertion order)
    return (Number(a.id) - Number(b.id)) * direction;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

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

  /**
   * Returns a paginated, sorted slice of the item catalogue.
   *
   * @param opts - filtering, pagination, and sorting options
   */
  getItems: (opts: GetItemsOptions = {}): PaginatedResult<ShopItem> => {
    const {
      activeOnly = false,
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
      sortBy = 'createdAt',
      sortOrder = 'asc',
    } = opts;

    // Clamp limit to [1, MAX_LIMIT]
    const clampedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    // Ensure page is at least 1
    const clampedPage = Math.max(1, page);

    // 1. Filter
    const filtered = activeOnly
      ? shopItems.filter((item) => item.isActive)
      : [...shopItems];

    // 2. Sort (on a copy so the master array is never mutated)
    const sorted = filtered.sort(buildComparator(sortBy, sortOrder));

    // 3. Paginate
    const total = sorted.length;
    const totalPages = Math.ceil(total / clampedLimit) || 1;
    const start = (clampedPage - 1) * clampedLimit;
    const items = sorted.slice(start, start + clampedLimit);

    return { items, total, page: clampedPage, limit: clampedLimit, totalPages };
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