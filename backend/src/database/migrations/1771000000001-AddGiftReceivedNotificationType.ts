import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGiftReceivedNotificationType1771000000001
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notifications_type_enum') THEN
          ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'gift_received';
        END IF;
      END $$;
    `);
  }

  async down(): Promise<void> {
    // PostgreSQL cannot safely remove an enum value while rows may use it.
  }
}
