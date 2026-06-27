export class PopularItemDto {
  itemId: string;
  itemName: string;
  purchaseCount: number;
  totalRevenue: number;
}

export class ShopAnalyticsDto {
  totalRevenue: number;
  popularItems: PopularItemDto[];
  conversionRate: number;
  retentionMetrics: {
    day1: number;
    day7: number;
    day30: number;
  };
}
