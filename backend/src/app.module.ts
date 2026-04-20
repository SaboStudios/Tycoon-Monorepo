import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validationSchema } from './config/env.validation';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { uploadConfig } from './config/upload.config';
import { databaseConfig } from './config/database.config';
import { gameConfig } from './config/game.config';
import { jwtConfig } from './config/jwt.config';
import { redisConfig } from './config/redis.config';
import { nearConfig } from './config/near.config';
import { CommonModule, HttpExceptionFilter, AppThrottlerGuard } from './common';
import { SuspensionCheckMiddleware } from './common/middleware/suspension-check.middleware';
import { User } from './modules/users/entities/user.entity';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminLogsModule } from './modules/admin-logs/admin-logs.module';
import { RedisModule } from './modules/redis/redis.module';
import { ChanceModule } from './modules/chance/chance.module';
import { CacheInterceptor } from './common/interceptors/cache.interceptor';
import { HealthController } from './health/health.controller';
import { PropertiesModule } from './modules/properties/properties.module';
import { CommunityChestModule } from './modules/community-chest/community-chest.module';
import { GamesModule } from './modules/games/games.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { ShopModule } from './modules/shop/shop.module';
import { SkinsModule } from './modules/skins/skins.module';
import { BoardStylesModule } from './modules/board-styles/board-styles.module';
import { GiftsModule } from './modules/gifts/gifts.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { PerksModule } from './modules/perks/perks.module';
import { PerksBoostsModule } from './modules/perks-boosts/perks-boosts.module';
import { AdminAnalyticsModule } from './modules/admin-analytics/admin-analytics.module';
import { MonetizationModule } from './modules/monetization/monetization.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { RawBodyMiddleware } from './common/middleware/raw-body.middleware';
import { JobsModule } from './modules/jobs/jobs.module';
import { EmailModule } from './modules/email/email.module';
import { AuditTrailModule } from './modules/audit-trail/audit-trail.module';
import { TourAnalyticsModule } from './modules/tour-analytics/tour-analytics.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { NearModule } from './modules/near/near.module';
import { LedgerReconciliationModule } from './modules/ledger-reconciliation/ledger-reconciliation.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, gameConfig, jwtConfig, redisConfig, uploadConfig, nearConfig],
      envFilePath: '.env',
      validationSchema,
      // Report ALL missing/invalid vars at once instead of stopping at the first.
      validationOptions: { abortEarly: false },
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    MetricsModule,

    // TypeORM Module
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database') as Record<
          string,
          unknown
        >;
        if (!dbConfig) {
          throw new Error('Database configuration not found');
        }
        return dbConfig;
      },
    }),

    // TypeORM for middleware
    TypeOrmModule.forFeature([User]),

    // Feature Modules
    RedisModule,
    CommonModule,
    UsersModule,
    AuthModule,

    PropertiesModule,
    ChanceModule,
    CommunityChestModule,
    GamesModule,
    AdminLogsModule,
    WaitlistModule,
    ShopModule,
    SkinsModule,
    BoardStylesModule,
    GiftsModule,
    CouponsModule,
    PerksModule,
    PerksBoostsModule,
    AdminAnalyticsModule,
    MonetizationModule,
    WebhooksModule,
    JobsModule,
    PrivacyModule,
    EmailModule,
    AuditTrailModule,
    TourAnalyticsModule,
    LedgerReconciliationModule,
    NearModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    SuspensionCheckMiddleware,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
      // useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SuspensionCheckMiddleware).forRoutes('*');
    consumer.apply(RawBodyMiddleware).forRoutes('webhooks/*');
  }
}
