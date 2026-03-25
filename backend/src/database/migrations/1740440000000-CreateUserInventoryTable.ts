import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateUserInventoryTable1740440000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_inventory',
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
            isNullable: false,
          },
          {
            name: 'shop_item_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'quantity',
            type: 'int',
            default: 1,
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create unique index on user_id + shop_item_id
    await queryRunner.createIndex(
      'user_inventory',
      new TableIndex({
        name: 'IDX_user_inventory_user_item',
        columnNames: ['user_id', 'shop_item_id'],
        isUnique: true,
      }),
    );

    // Create index on user_id for fast user lookups
    await queryRunner.createIndex(
      'user_inventory',
      new TableIndex({
        name: 'IDX_user_inventory_user_id',
        columnNames: ['user_id'],
      }),
    );

    // Create index on shop_item_id
    await queryRunner.createIndex(
      'user_inventory',
      new TableIndex({
        name: 'IDX_user_inventory_shop_item_id',
        columnNames: ['shop_item_id'],
      }),
    );

    // Create index on expires_at for expiration queries
    await queryRunner.createIndex(
      'user_inventory',
      new TableIndex({
        name: 'IDX_user_inventory_expires_at',
        columnNames: ['expires_at'],
      }),
    );

    // Foreign key to users table
    await queryRunner.createForeignKey(
      'user_inventory',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Foreign key to shop_items table
    await queryRunner.createForeignKey(
      'user_inventory',
      new TableForeignKey({
        columnNames: ['shop_item_id'],
        referencedTableName: 'shop_items',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_inventory');
  }
}
