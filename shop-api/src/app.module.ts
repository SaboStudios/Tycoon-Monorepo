import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PurchasesModule } from './purchases/purchases.module';
import { HealthModule } from './health/health.module';
import { Purchase } from './purchases/entities/purchase.entity';
import { IdempotencyRecord } from './idempotency/entities/idempotency-record.entity';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthController } from './health/health.controller';

/**
 * TypeORM `synchronize` is only allowed in the Jest test environment, which uses
 * an in-memory SQLite DB (see test/test-db.module.ts). Every other environment
 * must apply schema changes through migrations (`npm run migration:run`) so a
 * running service never mutates its own schema — especially staging.
 */
function resolveSynchronize(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (nodeEnv === 'test') return true;

  // Safety net: refuse to boot if an operator forces synchronize in staging.
  if (nodeEnv.includes('staging') && process.env.DB_SYNCHRONIZE === 'true') {
    throw new Error(
      'TypeORM synchronize is disabled in staging. Apply schema changes with migrations: npm run migration:run',
    );
  }

  return false;
}

@Module({
  controllers: [HealthController],
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'shop',
      entities: [Purchase, IdempotencyRecord],
      synchronize: resolveSynchronize(),
    }),
    ScheduleModule.forRoot(),
    PurchasesModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
