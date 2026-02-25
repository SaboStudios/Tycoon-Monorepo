import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePurchasesTable1740370000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'purchases',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_id',
            type: 'int',
          },
          {
            name: 'shop_item_id',
            type: 'int',
          },
          {
            name: 'quantity',
            type: 'int',
            default: 1,
          },
          {
            name: 'unit_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'total_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '10',
            default: "'USD'",
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '50',
            default: "'balance'",
          },
          {
            name: 'transaction_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'is_gift',
            type: 'boolean',
            default: false,
          },
          {
            name: 'gift_id',
            type: 'int',
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

    // Create indexes
    await queryRunner.createIndex(
      'purchases',
      new TableIndex({
        name: 'IDX_PURCHASES_USER_CREATED',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'purchases',
      new TableIndex({
        name: 'IDX_PURCHASES_SHOP_ITEM',
        columnNames: ['shop_item_id'],
      }),
    );

    await queryRunner.createIndex(
      'purchases',
      new TableIndex({
        name: 'IDX_PURCHASES_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'purchases',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'purchases',
      new TableForeignKey({
        columnNames: ['shop_item_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'shop_items',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'purchases',
      new TableForeignKey({
        columnNames: ['gift_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'gifts',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('purchases');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('purchases', foreignKey);
      }
    }

    await queryRunner.dropTable('purchases');
  }
}
