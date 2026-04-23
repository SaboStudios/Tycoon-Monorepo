import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateLedgerDiscrepanciesTable1743120000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ledger_discrepancies',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'runId', type: 'varchar', length: '100' },
          { name: 'purchaseId', type: 'int', isNullable: true },
          { name: 'transactionId', type: 'varchar', length: '100', isNullable: true },
          { name: 'type', type: 'varchar', length: '50' },
          { name: 'ledgerAmount', type: 'decimal', precision: 10, scale: 2, isNullable: true },
          { name: 'providerAmount', type: 'decimal', precision: 10, scale: 2, isNullable: true },
          { name: 'ledgerStatus', type: 'varchar', length: '50', isNullable: true },
          { name: 'providerStatus', type: 'varchar', length: '50', isNullable: true },
          { name: 'status', type: 'varchar', length: '50', default: "'open'" },
          { name: 'resolutionNote', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    for (const [name, cols] of [
      ['IDX_LEDGER_DISC_RUN_ID', ['runId']],
      ['IDX_LEDGER_DISC_TYPE', ['type']],
      ['IDX_LEDGER_DISC_STATUS', ['status']],
      ['IDX_LEDGER_DISC_PURCHASE_ID', ['purchaseId']],
    ] as [string, string[]][]) {
      await queryRunner.createIndex(
        'ledger_discrepancies',
        new TableIndex({ name, columnNames: cols }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ledger_discrepancies');
  }
}
