import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { shopHandlers } from '../src/mocks/handlers/shop';
import {
  mockShopItems,
  mockInventory,
  mockPurchase,
} from '../src/mocks/fixtures/shop';
import type {
  ShopItemResponse,
  UserInventoryResponse,
  PurchaseResponse,
  PaginatedResponse,
} from '../src/lib/api/types/dto';

const BASE = 'http://localhost:3000/api';

const server = setupServer(...shopHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── GET /api/shop/items ───────────────────────────────────────────────────────

describe('GET /api/shop/items', () => {
  async function fetchItems(): Promise<PaginatedResponse<ShopItemResponse>> {
    const res = await fetch(`${BASE}/shop/items`);
    return res.json();
  }

  it('returns 200', async () => {
    const res = await fetch(`${BASE}/shop/items`);
    expect(res.status).toBe(200);
  });

  it('envelope has data, total, page, limit — no totalPages', async () => {
    const body = await fetchItems();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
    expect(body).not.toHaveProperty('totalPages');
  });

  it('limit matches the handler constant (20)', async () => {
    const body = await fetchItems();
    expect(body.limit).toBe(20);
  });

  it('data length matches fixture length', async () => {
    const body = await fetchItems();
    expect(body.data).toHaveLength(mockShopItems.length);
  });

  it('each item has id as number', async () => {
    const { data } = await fetchItems();
    data.forEach((item) => expect(typeof item.id).toBe('number'));
  });

  it('each item has price as string (decimal)', async () => {
    const { data } = await fetchItems();
    data.forEach((item) => {
      expect(typeof item.price).toBe('string');
      expect(item.price).toMatch(/^\d+\.\d{2}$/);
    });
  });

  it('each item has a valid ShopItemType', async () => {
    const validTypes = ['dice', 'skin', 'symbol', 'theme', 'card'];
    const { data } = await fetchItems();
    data.forEach((item) => expect(validTypes).toContain(item.type));
  });

  it('each item has currency field', async () => {
    const { data } = await fetchItems();
    data.forEach((item) => expect(item).toHaveProperty('currency'));
  });

  it('each item has created_at and updated_at', async () => {
    const { data } = await fetchItems();
    data.forEach((item) => {
      expect(item).toHaveProperty('created_at');
      expect(item).toHaveProperty('updated_at');
    });
  });

  it('imageUrl is inside metadata, not top-level', async () => {
    const { data } = await fetchItems();
    data.forEach((item) => {
      expect(item).not.toHaveProperty('imageUrl');
    });
    // item 1 has imageUrl in metadata
    expect((data[0].metadata as Record<string, unknown>)?.imageUrl).toBe(
      '/game/boost-speed.svg',
    );
  });

  it('also matches query-string variant /api/shop/items?active=true', async () => {
    const res = await fetch(`${BASE}/shop/items?active=true`);
    expect(res.status).toBe(200);
    const body: PaginatedResponse<ShopItemResponse> = await res.json();
    expect(body.data).toHaveLength(mockShopItems.length);
  });
});

// ── GET /api/shop/inventory ───────────────────────────────────────────────────

describe('GET /api/shop/inventory', () => {
  async function fetchInventory(): Promise<UserInventoryResponse[]> {
    const res = await fetch(`${BASE}/shop/inventory`);
    return res.json();
  }

  it('returns 200', async () => {
    const res = await fetch(`${BASE}/shop/inventory`);
    expect(res.status).toBe(200);
  });

  it('returns an array', async () => {
    const body = await fetchInventory();
    expect(Array.isArray(body)).toBe(true);
  });

  it('each entry has user_id (not userId)', async () => {
    const body = await fetchInventory();
    body.forEach((entry) => {
      expect(entry).toHaveProperty('user_id');
      expect(entry).not.toHaveProperty('userId');
    });
  });

  it('each entry has shop_item_id (not itemId)', async () => {
    const body = await fetchInventory();
    body.forEach((entry) => {
      expect(entry).toHaveProperty('shop_item_id');
      expect(entry).not.toHaveProperty('itemId');
    });
  });

  it('each entry has a nested shop_item object', async () => {
    const body = await fetchInventory();
    body.forEach((entry) => {
      expect(entry).toHaveProperty('shop_item');
      expect(typeof entry.shop_item).toBe('object');
    });
  });

  it('each entry has expires_at (not expiresAt)', async () => {
    const body = await fetchInventory();
    body.forEach((entry) => {
      expect(entry).toHaveProperty('expires_at');
      expect(entry).not.toHaveProperty('expiresAt');
    });
  });

  it('each entry has created_at and updated_at', async () => {
    const body = await fetchInventory();
    body.forEach((entry) => {
      expect(entry).toHaveProperty('created_at');
      expect(entry).toHaveProperty('updated_at');
    });
  });

  it('fixture length matches mockInventory', async () => {
    const body = await fetchInventory();
    expect(body).toHaveLength(mockInventory.length);
  });
});

// ── POST /api/shop/purchase ───────────────────────────────────────────────────

describe('POST /api/shop/purchase', () => {
  async function postPurchase(): Promise<{ res: Response; body: PurchaseResponse }> {
    const res = await fetch(`${BASE}/shop/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_item_id: 1, quantity: 1 }),
    });
    return { res, body: await res.json() };
  }

  it('returns 201 (not 200)', async () => {
    const { res } = await postPurchase();
    expect(res.status).toBe(201);
  });

  it('body has user_id (not userId)', async () => {
    const { body } = await postPurchase();
    expect(body).toHaveProperty('user_id');
    expect(body).not.toHaveProperty('userId');
  });

  it('body has shop_item_id (not itemId)', async () => {
    const { body } = await postPurchase();
    expect(body).toHaveProperty('shop_item_id');
    expect(body).not.toHaveProperty('itemId');
  });

  it('body has total_price as string (not totalPrice as number)', async () => {
    const { body } = await postPurchase();
    expect(body).toHaveProperty('total_price');
    expect(typeof body.total_price).toBe('string');
    expect(body).not.toHaveProperty('totalPrice');
  });

  it('body has unit_price, original_price, discount_amount, final_price', async () => {
    const { body } = await postPurchase();
    expect(body).toHaveProperty('unit_price');
    expect(body).toHaveProperty('original_price');
    expect(body).toHaveProperty('discount_amount');
    expect(body).toHaveProperty('final_price');
  });

  it('body has created_at (not createdAt)', async () => {
    const { body } = await postPurchase();
    expect(body).toHaveProperty('created_at');
    expect(body).not.toHaveProperty('createdAt');
  });

  it('body has currency, payment_method, status, is_gift', async () => {
    const { body } = await postPurchase();
    expect(body).toHaveProperty('currency');
    expect(body).toHaveProperty('payment_method');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('is_gift');
  });

  it('body matches mockPurchase fixture shape', async () => {
    const { body } = await postPurchase();
    expect(body.id).toBe(mockPurchase.id);
    expect(body.status).toBe('completed');
    expect(body.is_gift).toBe(false);
  });
});

// ── GET /api/shop/purchases ───────────────────────────────────────────────────

describe('GET /api/shop/purchases', () => {
  it('returns 200', async () => {
    const res = await fetch(`${BASE}/shop/purchases`);
    expect(res.status).toBe(200);
  });

  it('returns an array of purchases', async () => {
    const res = await fetch(`${BASE}/shop/purchases`);
    const body: PurchaseResponse[] = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('each purchase has the correct snake_case fields', async () => {
    const res = await fetch(`${BASE}/shop/purchases`);
    const body: PurchaseResponse[] = await res.json();
    body.forEach((p) => {
      expect(p).toHaveProperty('user_id');
      expect(p).toHaveProperty('shop_item_id');
      expect(p).toHaveProperty('total_price');
      expect(p).toHaveProperty('created_at');
    });
  });
});

// ── POST /api/shop/gift ───────────────────────────────────────────────────────

describe('POST /api/shop/gift', () => {
  async function postGift(): Promise<{ res: Response; body: PurchaseResponse }> {
    const res = await fetch(`${BASE}/shop/gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_item_id: 1, recipient_user_id: 2 }),
    });
    return { res, body: await res.json() };
  }

  it('returns 201', async () => {
    const { res } = await postGift();
    expect(res.status).toBe(201);
  });

  it('body has is_gift: true', async () => {
    const { body } = await postGift();
    expect(body.is_gift).toBe(true);
  });

  it('body has the same purchase fields as a regular purchase', async () => {
    const { body } = await postGift();
    expect(body).toHaveProperty('user_id');
    expect(body).toHaveProperty('shop_item_id');
    expect(body).toHaveProperty('total_price');
    expect(body).toHaveProperty('status');
  });
});
