import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRefreshTokensForSecurity1740520000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename token column to tokenHash
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" RENAME COLUMN "token" TO "tokenHash"`,
    );

    // Add new metadata columns
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN "lastUsedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN "ipAddress" VARCHAR(45)`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN "userAgent" TEXT`,
    );

    // Clear existing tokens since they're not hashed
    await queryRunner.query(`DELETE FROM "refresh_tokens"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove new columns
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "userAgent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "ipAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "lastUsedAt"`,
    );

    // Rename tokenHash back to token
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" RENAME COLUMN "tokenHash" TO "token"`,
    );
  }
}
