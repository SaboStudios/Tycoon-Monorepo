import * as AdminAnalyticsBarrel from './index';
import { AdminAnalyticsModule } from './admin-analytics.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { DashboardAnalyticsDto } from './dto/dashboard-analytics.dto';

describe('admin-analytics index barrel (#1973)', () => {
  it('re-exports AdminAnalyticsModule', () => {
    expect(AdminAnalyticsBarrel.AdminAnalyticsModule).toBe(AdminAnalyticsModule);
  });

  it('re-exports AdminAnalyticsController', () => {
    expect(AdminAnalyticsBarrel.AdminAnalyticsController).toBe(
      AdminAnalyticsController,
    );
  });

  it('re-exports AdminAnalyticsService', () => {
    expect(AdminAnalyticsBarrel.AdminAnalyticsService).toBe(
      AdminAnalyticsService,
    );
  });

  it('re-exports DashboardAnalyticsDto from the DTO barrel entry', () => {
    expect(AdminAnalyticsBarrel.DashboardAnalyticsDto).toBe(
      DashboardAnalyticsDto,
    );

    // The barrel's DTO entry must point at a real, usable class, not a
    // type-only re-export that disappears at runtime.
    const instance = new AdminAnalyticsBarrel.DashboardAnalyticsDto();
    instance.totalUsers = 1;
    instance.activeUsers = 2;
    instance.totalGames = 3;
    instance.totalGamePlayers = 4;
    expect(instance).toBeInstanceOf(DashboardAnalyticsDto);
  });
});
