import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAdminTransactionsTable1771000000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'transactions',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'playerId', type: 'varchar' },
          { name: 'itemId', type: 'varchar' },
          { name: 'itemName', type: 'varchar' },
          { name: 'amount', type: 'decimal', precision: 10, scale: 2 },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_TRANSACTIONS_PLAYER_ID',
        columnNames: ['playerId'],
      }),
    );
    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_TRANSACTIONS_CREATED_AT',
        columnNames: ['createdAt'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('transactions');
  }
}
