import { Controller, Get } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsResponseDto } from "./dto/analytics-response.dto";

@Controller("admin/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("shop")
  async getShopAnalytics(): Promise<AnalyticsResponseDto> {
    return this.analyticsService.getShopAnalytics();
  }
}
