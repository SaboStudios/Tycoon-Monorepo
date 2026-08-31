import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: AddImagesToShopItems
 *
 * up()   — adds a nullable `images` jsonb column to `shop_items`.
 *           Existing rows get NULL (safe for live traffic; no lock on large tables
 *           because nullable columns without a DEFAULT require no rewrite in PG 11+).
 *
 * down() — drops the `images` column safely.
 *           Run `migration:revert` to roll back this change.
 *           NOTE: any application code that writes to `images` must be reverted
 *           before running down() to avoid runtime errors on the missing column.
 */
export class AddImagesToShopItems1745700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'shop_items',
      new TableColumn({
        name: 'images',
        type: 'jsonb',
        isNullable: true,
        comment: 'Array of image URLs associated with this shop item',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('shop_items', 'images');
  }
}
