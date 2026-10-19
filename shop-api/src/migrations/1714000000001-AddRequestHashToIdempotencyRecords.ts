import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRequestHashToIdempotencyRecords1714000000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'idempotency_records',
      new TableColumn({
        name: 'requestHash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('idempotency_records', 'requestHash');
  }
}