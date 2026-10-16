import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PurchasesModule } from './purchases/purchases.module';
import { HealthModule } from './health/health.module';
import { Purchase } from './purchases/entities/purchase.entity';
import { IdempotencyRecord } from './idempotency/entities/idempotency-record.entity';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthController } from './health/health.controller';
import { validationSchema } from './config/env.validation';

/**
 * TypeORM `synchronize` is only allowed in the Jest test environment, which uses
 * an in-memory SQLite DB (see test/test-db.module.ts). Every other environment
 * must apply schema changes through migrations (`npm run migration:run`) so a
 * running service never mutates its own schema — especially staging.
 */
export function resolveSynchronize(nodeEnv: string, dbSynchronize: boolean): boolean {
  if (nodeEnv === 'test') return true;

  // Safety net: refuse to boot if an operator forces synchronize in staging.
  if (nodeEnv.includes('staging') && dbSynchronize) {
    throw new Error(
      'TypeORM synchronize is disabled in staging. Apply schema changes with migrations: npm run migration:run',
    );
  }

  return false;
}
    throw new Error(
      'TypeORM synchronize is disabled in staging. Apply schema changes with migrations: npm run migration:run',
    );
  }

  return false;
}

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [Purchase, IdempotencyRecord],
        synchronize: resolveSynchronize(
          config.get<string>('NODE_ENV', 'development'),
          config.get<boolean>('DB_SYNCHRONIZE', false),
        ),
      }),
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
