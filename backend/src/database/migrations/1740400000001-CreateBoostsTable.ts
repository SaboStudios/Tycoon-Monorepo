import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateBoostsTable1740400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'boosts',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'perk_id',
            type: 'int',
          },
          {
            name: 'boost_type',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'effect_value',
            type: 'decimal',
            precision: 12,
            scale: 4,
          },
          {
            name: 'duration_seconds',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'stackable',
            type: 'boolean',
            default: false,
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
      'boosts',
      new TableIndex({ name: 'IDX_BOOSTS_PERK_ID', columnNames: ['perk_id'] }),
    );

    await queryRunner.createIndex(
      'boosts',
      new TableIndex({
        name: 'IDX_BOOSTS_BOOST_TYPE',
        columnNames: ['boost_type'],
      }),
    );

    await queryRunner.createForeignKey(
      'boosts',
      new TableForeignKey({
        columnNames: ['perk_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'perks',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('boosts');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('boosts', foreignKey);
      }
    }

    await queryRunner.dropTable('boosts');
  }
}
