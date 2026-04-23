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
];
