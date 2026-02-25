import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { Transaction } from "../entities/transaction.entity";
import { PlayerActivity } from "../entities/player-activity.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, PlayerActivity])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
