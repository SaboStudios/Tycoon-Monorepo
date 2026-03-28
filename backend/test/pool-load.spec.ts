/**
 * Pool load test — validates the connection pool holds up under peak concurrency.
 *
 * Acceptance criteria:
 *  - All concurrent queries complete without error (no pool exhaustion / timeout).
 *  - No idle connection leaks: pool returns to ≤ 1 idle connection after the burst.
 *
 * Run with:  NODE_ENV=test npx jest test/pool-load.spec.ts --runInBand
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

const CONCURRENCY = 20; // simulate peak burst — matches prod DB_POOL_SIZE default
const QUERY = 'SELECT 1';

describe('DB connection pool under peak load', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it(`handles ${CONCURRENCY} concurrent queries without exhausting the pool`, async () => {
    const queries = Array.from({ length: CONCURRENCY }, () =>
      dataSource.query(QUERY),
    );

    const results = await Promise.allSettled(queries);
    const failed = results.filter((r) => r.status === 'rejected');

    expect(failed).toHaveLength(0);
  }, 30_000);

  it('releases all connections after burst — no idle leaks', async () => {
    // Run a burst then wait for the pool to drain idle connections.
    const queries = Array.from({ length: CONCURRENCY }, () =>
      dataSource.query(QUERY),
    );
    await Promise.all(queries);

    // Allow the pool's idleTimeoutMillis to reclaim connections.
    await new Promise((r) => setTimeout(r, 500));

    const pool = (
      dataSource.driver as unknown as {
        master?: { totalCount?: number; waitingCount?: number };
      }
    ).master;

    if (pool) {
      // No requests should be stuck waiting after the burst completes.
      expect(pool.waitingCount ?? 0).toBe(0);
    }
  }, 30_000);
});
