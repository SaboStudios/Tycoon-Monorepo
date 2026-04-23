import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateActiveBoostsTable1740400000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'active_boosts',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'player_id',
            type: 'int',
          },
          {
            name: 'boost_id',
            type: 'int',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'remaining_uses',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'activated_at',
            type: 'timestamp',
            default: 'now()',
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

    await queryRunner.createIndex(
      'active_boosts',
      new TableIndex({
        name: 'IDX_ACTIVE_BOOSTS_PLAYER_ID',
        columnNames: ['player_id'],
      }),
    );

    await queryRunner.createIndex(
      'active_boosts',
      new TableIndex({
        name: 'IDX_ACTIVE_BOOSTS_BOOST_ID',
        columnNames: ['boost_id'],
      }),
    );

    await queryRunner.createIndex(
      'active_boosts',
      new TableIndex({
        name: 'IDX_ACTIVE_BOOSTS_EXPIRES_AT',
        columnNames: ['expires_at'],
      }),
    );

    await queryRunner.createIndex(
      'active_boosts',
      new TableIndex({
        name: 'IDX_ACTIVE_BOOSTS_PLAYER_EXPIRES',
        columnNames: ['player_id', 'expires_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'active_boosts',
      new TableForeignKey({
        columnNames: ['player_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'active_boosts',
      new TableForeignKey({
        columnNames: ['boost_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'boosts',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('active_boosts');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('active_boosts', foreignKey);
      }
    }

    await queryRunner.dropTable('active_boosts');
  }
}
