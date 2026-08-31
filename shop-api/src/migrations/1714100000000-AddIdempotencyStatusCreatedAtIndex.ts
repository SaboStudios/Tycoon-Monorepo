import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Adds a composite index on (status, createdAt) to idempotency_records so
 * the TTL purge job (IdempotencyCleanupService) can efficiently find
 * COMPLETED rows older than the retention window without a full table scan.
 *
 * Run:  npx typeorm migration:run -d src/data-source.ts
 * Undo: npx typeorm migration:revert -d src/data-source.ts
 */
export class AddIdempotencyStatusCreatedAtIndex1714100000000
  implements MigrationInterface
{
  private readonly indexName = 'IDX_idempotency_records_status_createdAt';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'idempotency_records',
      new TableIndex({
        name: this.indexName,
        columnNames: ['status', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('idempotency_records', this.indexName);
  }
}
