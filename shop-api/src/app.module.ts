import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasesModule } from './purchases/purchases.module';
import { HealthModule } from './health/health.module';

export function resolveSynchronize(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  const dbSynchronize = process.env.DB_SYNCHRONIZE;

  if (nodeEnv === 'test') {
    return true;
  }

  if (nodeEnv === 'staging' && dbSynchronize === 'true') {
    throw new Error(
      'DB_SYNCHRONIZE must not be enabled in staging; run migration:run instead.',
    );
  }

  return false;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'shop'),
        autoLoadEntities: true,
        synchronize: resolveSynchronize(),
      }),
    }),
    PurchasesModule,
    HealthModule,
  ],
})
export class AppModule {}
