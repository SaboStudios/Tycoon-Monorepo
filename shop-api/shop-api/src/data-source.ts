/**
 * TypeORM DataSource used by the CLI for migrations.
 * Usage: npx typeorm -d src/data-source.ts migration:run
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Purchase } from './purchases/entities/purchase.entity';
import { IdempotencyRecord } from './idempotency/entities/idempotency-record.entity';
import { CreateIdempotencyAndPurchases1714000000000 } from './migrations/1714000000000-CreateIdempotencyAndPurchases';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'shop',
  entities: [Purchase, IdempotencyRecord],
  migrations: [CreateIdempotencyAndPurchases1714000000000],
  migrationsRun: false,
  synchronize: false,
});
