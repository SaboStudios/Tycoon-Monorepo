import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #1766 — at most one active (pending/processing) data export per user.
 *
 * Makes POST /users/me/data-export idempotent under concurrency: a duplicate
 * request that loses the race hits this index and is answered with the
 * existing job instead of enqueuing a second export.
 *
 * Order of operations: pre-existing duplicate active rows (possible before
 * this change) are marked `failed`, keeping only the newest per user, so the
 * index can always be created. Rollback (`migration:revert`) drops the index
 * only; superseded rows stay `failed` (users can simply request again).
 */
export class AddActiveUserDataExportUniqueIndex1759000000000
  implements MigrationInterface
{
  name = 'AddActiveUserDataExportUniqueIndex1759000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user_data_export_jobs" AS j
         SET "status" = 'failed',
             "error_message" = 'Superseded by a newer export request.'
       WHERE j."status" IN ('pending', 'processing')
         AND EXISTS (
           SELECT 1 FROM "user_data_export_jobs" AS newer
            WHERE newer."user_id" = j."user_id"
              AND newer."status" IN ('pending', 'processing')
              AND newer."id" > j."id"
         )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_data_export_jobs_active_user"
          ON "user_data_export_jobs" ("user_id")
       WHERE "status" IN ('pending', 'processing')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_user_data_export_jobs_active_user"`,
    );
  }
}
