import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { TourAnalyticsService } from './tour-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TrackTourEventDto } from './dto/track-tour-event.dto';

@Controller('analytics/tour')
@UseGuards(JwtAuthGuard)
export class TourAnalyticsController {
  constructor(private readonly tourAnalyticsService: TourAnalyticsService) {}

  @Post()
  async trackTourEvent(
    @Request() req: { user: { id: number } },
    @Body() eventDto: TrackTourEventDto,
  ): Promise<{ success: boolean }> {
    await this.tourAnalyticsService.trackEvent(
      req.user.id,
      eventDto.event,
      eventDto.data,
    );
    return { success: true };
  }
}
