import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdempotencyRecord } from "./idempotency-record.entity";
import { IdempotencyService } from "./idempotency.service";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyRecord])],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
