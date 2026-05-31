import { IsInt, Min } from 'class-validator';

export class DashboardAnalyticsDto {
  @IsInt()
  @Min(0)
  totalUsers: number;

  @IsInt()
  @Min(0)
  activeUsers: number;

  @IsInt()
  @Min(0)
  totalGames: number;

  @IsInt()
  @Min(0)
  totalGamePlayers: number;
}
