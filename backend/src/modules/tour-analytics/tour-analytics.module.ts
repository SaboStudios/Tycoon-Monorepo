import { Module } from '@nestjs/common';
import { TourAnalyticsController } from './tour-analytics.controller';
import { TourAnalyticsService } from './tour-analytics.service';

@Module({
  controllers: [TourAnalyticsController],
  providers: [TourAnalyticsService],
  exports: [TourAnalyticsService],
})
export class TourAnalyticsModule {}
