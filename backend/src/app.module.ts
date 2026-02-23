import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validationSchema } from './config/env.validation';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { gameConfig } from './config/game.config';
import { jwtConfig } from './config/jwt.config';
import { redisConfig } from './config/redis.config';
import { CommonModule, HttpExceptionFilter } from './common';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { RedisModule } from './modules/redis/redis.module';
import { ChanceModule } from './modules/chance/chance.module';
import { CacheInterceptor } from './common/interceptors/cache.interceptor';
import { HealthController } from './health/health.controller';
import { PropertiesModule } from './modules/properties/properties.module';
import { CommunityChestModule } from './modules/community-chest/community-chest.module';
import { GamesModule } from './modules/games/games.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, gameConfig, jwtConfig, redisConfig],
      envFilePath: '.env',
      validationSchema,
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

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

    // Feature Modules
    RedisModule,
    CommonModule,
    UsersModule,
    AuthModule,
    AuthModule,

    PropertiesModule,
    ChanceModule,
    CommunityChestModule,
    GamesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
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
export class AppModule {}
