import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { TourAnalyticsService } from './tour-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface TourEventDto {
  event: 'tour_started' | 'tour_completed' | 'tour_skipped' | 'tour_step_viewed';
  data: {
    step?: number;
    totalSteps?: number;
    stepId?: string;
    timestamp?: string;
  };
}

@Controller('analytics/tour')
@UseGuards(JwtAuthGuard)
export class TourAnalyticsController {
  constructor(private readonly tourAnalyticsService: TourAnalyticsService) {}

  @Post()
  async trackTourEvent(
    @Request() req: { user: { id: number } },
    @Body() eventDto: TourEventDto,
  ): Promise<{ success: boolean }> {
    await this.tourAnalyticsService.trackEvent(req.user.id, eventDto.event, eventDto.data);
    return { success: true };
  }
}
