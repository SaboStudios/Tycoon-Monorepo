import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase]), IdempotencyModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
