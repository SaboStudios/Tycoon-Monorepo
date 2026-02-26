import {
  MigrationInterface,
  QueryRunner,
  TableIndex,
} from 'typeorm';

export class CreatePerksTable1740400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "perk_type_enum" AS ENUM (
        'permanent', 'temporary', 'consumable'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "perk_category_enum" AS ENUM (
        'economy', 'defense', 'movement'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "perks" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "description" text,
        "type" "perk_type_enum" NOT NULL,
        "category" "perk_category_enum" NOT NULL,
        "rarity" varchar(50) DEFAULT 'common',
        "price" decimal(10,2) NOT NULL,
        "metadata" json,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);

    await queryRunner.createIndex(
      'perks',
      new TableIndex({ name: 'IDX_PERKS_TYPE', columnNames: ['type'] }),
    );

    await queryRunner.createIndex(
      'perks',
      new TableIndex({ name: 'IDX_PERKS_CATEGORY', columnNames: ['category'] }),
    );

    await queryRunner.createIndex(
      'perks',
      new TableIndex({ name: 'IDX_PERKS_RARITY', columnNames: ['rarity'] }),
    );

    await queryRunner.createIndex(
      'perks',
      new TableIndex({ name: 'IDX_PERKS_IS_ACTIVE', columnNames: ['is_active'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('perks');
    await queryRunner.query(`DROP TYPE IF EXISTS "perk_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "perk_category_enum"`);
  }
}
