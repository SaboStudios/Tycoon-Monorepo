import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreatePlayerPerksTable1740400000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'player_perks',
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
            name: 'perk_id',
            type: 'int',
          },
          {
            name: 'quantity',
            type: 'int',
            default: 1,
          },
          {
            name: 'acquired_at',
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
      'player_perks',
      new TableIndex({
        name: 'IDX_PLAYER_PERKS_PLAYER_ID',
        columnNames: ['player_id'],
      }),
    );

    await queryRunner.createIndex(
      'player_perks',
      new TableIndex({
        name: 'IDX_PLAYER_PERKS_PERK_ID',
        columnNames: ['perk_id'],
      }),
    );

    await queryRunner.createIndex(
      'player_perks',
      new TableIndex({
        name: 'IDX_PLAYER_PERKS_PLAYER_PERK',
        columnNames: ['player_id', 'perk_id'],
      }),
    );

    await queryRunner.createIndex(
      'player_perks',
      new TableIndex({
        name: 'IDX_PLAYER_PERKS_ACQUIRED_AT',
        columnNames: ['acquired_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'player_perks',
      new TableForeignKey({
        columnNames: ['player_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'player_perks',
      new TableForeignKey({
        columnNames: ['perk_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'perks',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('player_perks');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('player_perks', foreignKey);
      }
    }

    await queryRunner.dropTable('player_perks');
  }
}
