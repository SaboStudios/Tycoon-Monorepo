import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateCouponsTable1740370000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "coupon_type_enum" AS ENUM ('percentage', 'fixed')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'coupons',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'code',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['percentage', 'fixed'],
          },
          {
            name: 'value',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'max_uses',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'current_usage',
            type: 'int',
            default: 0,
          },
          {
            name: 'expiration',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'item_restriction_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'min_purchase_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'max_discount_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'coupons',
      new TableIndex({
        name: 'IDX_COUPONS_CODE',
        columnNames: ['code'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'coupons',
      new TableIndex({
        name: 'IDX_COUPONS_ACTIVE_EXPIRATION',
        columnNames: ['active', 'expiration'],
      }),
    );

    await queryRunner.createIndex(
      'coupons',
      new TableIndex({
        name: 'IDX_COUPONS_TYPE',
        columnNames: ['type'],
      }),
    );

    await queryRunner.createForeignKey(
      'coupons',
      new TableForeignKey({
        columnNames: ['item_restriction_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'shop_items',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('coupons');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('coupons', foreignKey);
      }
    }

    await queryRunner.dropTable('coupons');
    await queryRunner.query(`DROP TYPE IF EXISTS "coupon_type_enum"`);
  }
}
