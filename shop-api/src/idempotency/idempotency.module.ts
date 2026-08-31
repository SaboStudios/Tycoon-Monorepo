import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyRecord } from './entities/idempotency-record.entity';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyRecord])],
  providers: [IdempotencyService, IdempotencyCleanupService],
  exports: [IdempotencyService, IdempotencyCleanupService],
})
export class IdempotencyModule {}
