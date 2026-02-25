import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Transaction } from "../entities/transaction.entity";
import { PlayerActivity } from "../entities/player-activity.entity";
import {
  AnalyticsResponseDto,
  PopularItemDto,
} from "./dto/analytics-response.dto";

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(PlayerActivity)
    private activityRepo: Repository<PlayerActivity>,
  ) {}

  async getShopAnalytics(): Promise<AnalyticsResponseDto> {
    const [totalRevenue, popularItems, conversionRate, retentionMetrics] =
      await Promise.all([
        this.getTotalRevenue(),
        this.getPopularItems(),
        this.getConversionRate(),
        this.getRetentionMetrics(),
      ]);

    return {
      totalRevenue,
      popularItems,
      conversionRate,
      retentionMetrics,
    };
  }

  private async getTotalRevenue(): Promise<number> {
    const result = await this.transactionRepo
      .createQueryBuilder("transaction")
      .select("SUM(transaction.amount)", "total")
      .getRawOne();

    return parseFloat(result?.total || "0");
  }

  private async getPopularItems(): Promise<PopularItemDto[]> {
    const items = await this.transactionRepo
      .createQueryBuilder("transaction")
      .select("transaction.itemId", "itemId")
      .addSelect("transaction.itemName", "itemName")
      .addSelect("COUNT(*)", "purchaseCount")
      .addSelect("SUM(transaction.amount)", "totalRevenue")
      .groupBy("transaction.itemId")
      .addGroupBy("transaction.itemName")
      .orderBy("COUNT(*)", "DESC")
      .limit(10)
      .getRawMany();

    return items.map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      purchaseCount: parseInt(item.purchaseCount),
      totalRevenue: parseFloat(item.totalRevenue),
    }));
  }

  private async getConversionRate(): Promise<number> {
    const totalPlayers = await this.activityRepo
      .createQueryBuilder("activity")
      .select("COUNT(DISTINCT activity.playerId)", "count")
      .getRawOne();

    const purchasedPlayers = await this.transactionRepo
      .createQueryBuilder("transaction")
      .select("COUNT(DISTINCT transaction.playerId)", "count")
      .getRawOne();

    const total = parseInt(totalPlayers?.count || "0");
    const purchased = parseInt(purchasedPlayers?.count || "0");

    return total > 0 ? (purchased / total) * 100 : 0;
  }

  private async getRetentionMetrics(): Promise<{
    day1: number;
    day7: number;
    day30: number;
  }> {
    const now = new Date();

    const day1 = await this.calculateRetention(1, now);
    const day7 = await this.calculateRetention(7, now);
    const day30 = await this.calculateRetention(30, now);

    return { day1, day7, day30 };
  }

  private async calculateRetention(days: number, now: Date): Promise<number> {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days - 1);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - days);

    const initialPlayers = await this.activityRepo
      .createQueryBuilder("activity")
      .select("DISTINCT activity.playerId", "playerId")
      .where("activity.createdAt >= :start AND activity.createdAt < :end", {
        start: startDate,
        end: endDate,
      })
      .getRawMany();

    if (initialPlayers.length === 0) return 0;

    const returnedPlayers = await this.activityRepo
      .createQueryBuilder("activity")
      .select("COUNT(DISTINCT activity.playerId)", "count")
      .where("activity.playerId IN (:...playerIds)", {
        playerIds: initialPlayers.map((p) => p.playerId),
      })
      .andWhere("activity.createdAt >= :end", { end: endDate })
      .getRawOne();

    const returned = parseInt(returnedPlayers?.count || "0");
    return (returned / initialPlayers.length) * 100;
  }
}
