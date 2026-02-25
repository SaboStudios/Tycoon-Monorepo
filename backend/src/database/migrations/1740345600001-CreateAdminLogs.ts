import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateAdminLogs1740345600001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'is_suspended',
        type: 'boolean',
        default: false,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'admin_logs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'adminId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'targetId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'admin_logs',
      new TableIndex({
        name: 'IDX_ADMIN_LOGS_ACTION',
        columnNames: ['action'],
      }),
    );

    await queryRunner.createIndex(
      'admin_logs',
      new TableIndex({
        name: 'IDX_ADMIN_LOGS_TARGET_ID',
        columnNames: ['targetId'],
      }),
    );

    await queryRunner.createIndex(
      'admin_logs',
      new TableIndex({
        name: 'IDX_ADMIN_LOGS_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'admin_logs',
      new TableForeignKey({
        columnNames: ['adminId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('admin_logs');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('adminId') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('admin_logs', foreignKey);
      }
    }
    await queryRunner.dropTable('admin_logs');
    await queryRunner.dropColumn('users', 'is_suspended');
  }
}
