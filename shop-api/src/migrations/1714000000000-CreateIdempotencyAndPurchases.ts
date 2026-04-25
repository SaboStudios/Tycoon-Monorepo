import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Creates the purchases and idempotency_records tables.
 *
 * Run:  npx typeorm migration:run -d src/data-source.ts
 * Undo: npx typeorm migration:revert -d src/data-source.ts
 */
export class CreateIdempotencyAndPurchases1714000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── purchases ────────────────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'purchases',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
          { name: 'userId', type: 'varchar' },
          { name: 'itemId', type: 'varchar' },
          { name: 'amount', type: 'decimal', precision: 10, scale: 2 },
          { name: 'status', type: 'varchar', default: "'PENDING'" },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // ── idempotency_records ──────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'idempotency_records',
        columns: [
          { name: 'idempotencyKey', type: 'varchar', length: '255', isPrimary: true },
          { name: 'operation', type: 'varchar', length: '64' },
          { name: 'status', type: 'varchar', default: "'PROCESSING'" },
          { name: 'responseBody', type: 'text', isNullable: true },
          { name: 'responseStatus', type: 'int', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'completedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'idempotency_records',
      new TableIndex({
        name: 'IDX_idempotency_records_operation',
        columnNames: ['operation'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('idempotency_records', true);
    await queryRunner.dropTable('purchases', true);
  }
}
