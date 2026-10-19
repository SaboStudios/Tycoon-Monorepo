import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdempotencyRecord } from "./idempotency-record.entity";
import { IdempotencyService } from "./idempotency.service";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IdempotencyPurgeScheduler } from "./idempotency-purge.scheduler";

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyRecord]), ScheduleModule.forRoot()],
  providers: [IdempotencyService, IdempotencyInterceptor, IdempotencyPurgeScheduler],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
