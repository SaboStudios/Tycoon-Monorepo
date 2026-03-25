import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateCouponUsageLogsTable1740390000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'coupon_usage_logs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'coupon_id',
            type: 'int',
          },
          {
            name: 'user_id',
            type: 'int',
          },
          {
            name: 'purchase_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'coupon_code',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'original_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'discount_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'final_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'coupon_usage_logs',
      new TableIndex({
        name: 'IDX_COUPON_USAGE_LOGS_COUPON_CREATED',
        columnNames: ['coupon_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'coupon_usage_logs',
      new TableIndex({
        name: 'IDX_COUPON_USAGE_LOGS_USER_CREATED',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'coupon_usage_logs',
      new TableIndex({
        name: 'IDX_COUPON_USAGE_LOGS_PURCHASE',
        columnNames: ['purchase_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'coupon_usage_logs',
      new TableForeignKey({
        columnNames: ['coupon_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'coupons',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'coupon_usage_logs',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'coupon_usage_logs',
      new TableForeignKey({
        columnNames: ['purchase_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'purchases',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('coupon_usage_logs');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('coupon_usage_logs', foreignKey);
      }
    }

    await queryRunner.dropTable('coupon_usage_logs');
  }
}
