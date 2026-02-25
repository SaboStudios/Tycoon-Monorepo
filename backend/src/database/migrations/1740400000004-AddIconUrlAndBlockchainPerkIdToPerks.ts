import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIconUrlAndBlockchainPerkIdToPerks1740400000004
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "perks"
      ADD COLUMN "icon_url" varchar(500),
      ADD COLUMN "blockchain_perk_id" smallint
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_PERKS_BLOCKCHAIN_PERK_ID"
      ON "perks" ("blockchain_perk_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_PERKS_BLOCKCHAIN_PERK_ID"`,
    );
    await queryRunner.query(`
      ALTER TABLE "perks"
      DROP COLUMN "icon_url",
      DROP COLUMN "blockchain_perk_id"
    `);
  }
}
