import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasesModule } from './purchases/purchases.module';
import { Purchase } from './purchases/entities/purchase.entity';
import { IdempotencyRecord } from './idempotency/entities/idempotency-record.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'shop',
      entities: [Purchase, IdempotencyRecord],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    PurchasesModule,
  ],
})
export class AppModule {}
