import { http, HttpResponse } from 'msw';
import { mockInventory, mockPurchase, mockShopItems } from '../fixtures/shop';

const LIMIT = 20;

export const shopHandlers = [
  // GET /api/shop/items — paginated list
  http.get(/\/api\/shop\/items(\?.*)?$/, () => {
    return HttpResponse.json({
      data: mockShopItems,
      total: mockShopItems.length,
      page: 1,
      limit: LIMIT,
    });
  }),

  // GET /api/shop/inventory — authenticated user's inventory
  http.get(/\/api\/shop\/inventory/, () => {
    return HttpResponse.json(mockInventory);
  }),

  // POST /api/shop/purchase — create a purchase (201)
  http.post(/\/api\/shop\/purchase/, () => {
    return HttpResponse.json(mockPurchase, { status: 201 });
  }),

  // GET /api/shop/purchases — purchase history
  http.get(/\/api\/shop\/purchases$/, () => {
    return HttpResponse.json([mockPurchase]);
  }),

  // POST /api/shop/gift — purchase and gift an item (201)
  http.post(/\/api\/shop\/gift/, () => {
    return HttpResponse.json(
      { ...mockPurchase, is_gift: true },
      { status: 201 },
    );
  }),
];
