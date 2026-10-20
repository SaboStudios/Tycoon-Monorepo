/**
 * In-memory SQLite TypeORM module used exclusively in Jest tests.
 * No external DB required — each test suite gets a fresh database.
 */
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from '../purchases/entities/purchase.entity';
import { IdempotencyRecord } from '../idempotency/entities/idempotency-record.entity';

export const TestDbModule = TypeOrmModule.forRoot({
  type: 'better-sqlite3',
  database: ':memory:',
  entities: [Purchase, IdempotencyRecord],
  synchronize: true,
  dropSchema: true,
});
