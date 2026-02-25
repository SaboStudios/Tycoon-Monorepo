import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnalyticsModule } from "./analytics/analytics.module";
import { Transaction } from "./entities/transaction.entity";
import { PlayerActivity } from "./entities/player-activity.entity";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "sqlite",
      database: ":memory:",
      entities: [Transaction, PlayerActivity],
      synchronize: true,
    }),
    AnalyticsModule,
  ],
})
export class AppModule {}
