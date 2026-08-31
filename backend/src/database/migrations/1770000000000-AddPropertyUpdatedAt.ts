import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPropertyUpdatedAt1770000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'properties',
      new TableColumn({
        name: 'updated_at',
        type: 'timestamp',
        default: 'CURRENT_TIMESTAMP',
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('properties', 'updated_at');
  }
}
