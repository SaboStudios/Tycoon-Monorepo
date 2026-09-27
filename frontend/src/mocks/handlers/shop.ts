import { http, HttpResponse } from "msw";
import { mockInventory, mockPurchase, mockShopItems } from "../fixtures/shop";

export const shopHandlers = [
  http.get(/\/api\/shop\/items(\?.*)?$/, () => {
    return HttpResponse.json({
      data: mockShopItems,
      page: 1,
      totalPages: 1,
      total: mockShopItems.length,
    });
  }),
  http.get(/\/api\/shop\/inventory/, () => {
    return HttpResponse.json({ data: mockInventory });
  }),
  http.post(/\/api\/shop\/purchase/, () => {
    return HttpResponse.json(mockPurchase);
  }),
];
