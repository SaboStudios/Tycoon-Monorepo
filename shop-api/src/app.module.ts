import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PurchasesModule } from './purchases/purchases.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { Purchase } from './purchases/entities/purchase.entity';
import { IdempotencyRecord } from './idempotency/entities/idempotency-record.entity';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
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

/**
 * Parse `DB_PORT` into a valid TCP port. Falls back to 5432 only when the
 * variable is unset; throws a descriptive error for non-numeric or
 * out-of-range values so a typo fails fast at boot instead of producing a
 * TypeORM config with `port: NaN`.
 */
export function resolveDbPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.DB_PORT;
  if (raw === undefined) return 5432;

  const port = Number.parseInt(raw, 10);
  if (Number.isNaN(port) || !/^\d+$/.test(raw.trim())) {
    throw new Error(
      `Invalid DB_PORT: expected an integer between 1 and 65535, got "${raw}"`,
    );
  }
  if (port < 1 || port > 65535) {
    throw new Error(
      `Invalid DB_PORT: expected an integer between 1 and 65535, got "${raw}"`,
    );
  }

  return port;
}

@Module({
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
        port: resolveDbPort(),
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
    AuthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
