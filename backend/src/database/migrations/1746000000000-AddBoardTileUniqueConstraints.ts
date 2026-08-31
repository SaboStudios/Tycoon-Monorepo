import {
  MigrationInterface,
  QueryRunner,
  TableIndex,
  TableUnique,
} from 'typeorm';

/**
 * Add unique constraints to board tile tables (#1437).
 * Ensures position is unique per table so seed scripts can safely upsert
 * without creating duplicates on re-runs.
 */
export class AddBoardTileUniqueConstraints1746000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unique constraint on position for properties table
    await queryRunner.createIndex(
      'properties',
      new TableIndex({
        name: 'IDX_PROPERTIES_POSITION_UNIQUE',
        columnNames: ['position'],
        isUnique: true,
      }),
    );

    // Add unique constraint on position for chances table
    await queryRunner.createIndex(
      'chances',
      new TableIndex({
        name: 'IDX_CHANCES_POSITION_UNIQUE',
        columnNames: ['position'],
        isUnique: true,
        where: 'position IS NOT NULL',
      }),
    );

    // Add unique constraint on position for community_chests table
    await queryRunner.createIndex(
      'community_chests',
      new TableIndex({
        name: 'IDX_COMMUNITY_CHESTS_POSITION_UNIQUE',
        columnNames: ['position'],
        isUnique: true,
        where: 'position IS NOT NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('properties', 'IDX_PROPERTIES_POSITION_UNIQUE');
    await queryRunner.dropIndex('chances', 'IDX_CHANCES_POSITION_UNIQUE');
    await queryRunner.dropIndex(
      'community_chests',
      'IDX_COMMUNITY_CHESTS_POSITION_UNIQUE',
    );
  }
}
