import { registerAs } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load .env for TypeORM CLI (Nest uses ConfigModule separately)
dotenv.config();

/**
 * Entity auto-sync is only allowed in local development.
 * Production and provision NEVER synchronize — schema changes must go through migrations.
 */
export function resolveTypeOrmSynchronize(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production' || nodeEnv === 'provision') {
    if (process.env.DB_SYNCHRONIZE === 'true') {
      console.warn(
        '[database] DB_SYNCHRONIZE is ignored when NODE_ENV is production or provision. Apply versioned migrations instead.',
      );
    }
    return false;
  }
  return process.env.DB_SYNCHRONIZE === 'true';
}

function buildDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'tycoon_db',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: resolveTypeOrmSynchronize(),
    logging: process.env.DB_LOGGING === 'true',
    migrations: [__dirname + '/../database/migrations/**/*{.ts,.js}'],
    migrationsTableName: 'migrations',
  };
}

export const databaseConfig = registerAs('database', (): DataSourceOptions => {
  return buildDataSourceOptions();
});

/** TypeORM CLI + seed scripts — never use synchronize (migrations only). */
export const AppDataSource = new DataSource({
  ...buildDataSourceOptions(),
  synchronize: false,
});

export default AppDataSource;
