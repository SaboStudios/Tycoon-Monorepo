import { http, HttpResponse } from 'msw';
import { mockInventory, mockPurchase, mockShopItems } from '../fixtures/shop';

const LIMIT = 20;

export const shopHandlers = [
  http.get(/\/api\/shop\/items(\?.*)?$/, () => {
    return HttpResponse.json({
      data: mockShopItems,
      total: mockShopItems.length,
      page: 1,
      limit: LIMIT,
    });
  }),
  http.get(/\/api\/shop\/inventory/, () => {
    return HttpResponse.json(mockInventory);
  }),
  http.post(/\/api\/shop\/purchase/, () => {
    return HttpResponse.json(mockPurchase, { status: 201 });
  }),
];
