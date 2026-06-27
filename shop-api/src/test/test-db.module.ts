/**
 * In-memory SQLite TypeORM module used exclusively in Jest tests.
 * No external DB required — each test suite gets a fresh database.
 */
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from '../purchases/entities/purchase.entity';
import { IdempotencyRecord } from '../idempotency/entities/idempotency-record.entity';

// CommonJS export — default import is not the constructor under Jest/TS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3') as typeof import('better-sqlite3');

export const TestDbModule = TypeOrmModule.forRoot({
  type: 'better-sqlite3',
  driver: Database,
  database: ':memory:',
  entities: [Purchase, IdempotencyRecord],
  synchronize: true,
  dropSchema: true,
});
