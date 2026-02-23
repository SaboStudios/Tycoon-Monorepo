import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
} from 'typeorm';

export class CreateShopItemsTable1740350960000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type first (PostgreSQL)
        await queryRunner.query(`
      CREATE TYPE "shop_item_type_enum" AS ENUM (
        'dice', 'skin', 'symbol', 'theme', 'card'
      )
    `);

        await queryRunner.createTable(
            new Table({
                name: 'shop_items',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '255',
                        isUnique: true,
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'type',
                        type: 'enum',
                        enum: ['dice', 'skin', 'symbol', 'theme', 'card'],
                    },
                    {
                        name: 'price',
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
                        name: 'metadata',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'rarity',
                        type: 'varchar',
                        length: '50',
                        default: "'common'",
                    },
                    {
                        name: 'active',
                        type: 'boolean',
                        default: true,
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

        // Indexes for common query patterns
        await queryRunner.createIndex(
            'shop_items',
            new TableIndex({ name: 'IDX_SHOP_ITEMS_TYPE', columnNames: ['type'] }),
        );
        await queryRunner.createIndex(
            'shop_items',
            new TableIndex({ name: 'IDX_SHOP_ITEMS_RARITY', columnNames: ['rarity'] }),
        );
        await queryRunner.createIndex(
            'shop_items',
            new TableIndex({ name: 'IDX_SHOP_ITEMS_ACTIVE', columnNames: ['active'] }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('shop_items');
        await queryRunner.query(`DROP TYPE IF EXISTS "shop_item_type_enum"`);
    }
}
