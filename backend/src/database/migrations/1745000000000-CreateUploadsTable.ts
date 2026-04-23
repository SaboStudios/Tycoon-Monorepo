import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUploadsTable1745000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'uploads',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'key',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'originalName',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'mimeType',
                        type: 'varchar',
                        length: '100',
                    },
                    {
                        name: 'size',
                        type: 'bigint',
                        isNullable: true,
                    },
                    {
                        name: 'userId',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'metadata',
                        type: 'jsonb',
                        isNullable: true,
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

        for (const [name, cols] of [
            ['IDX_UPLOADS_KEY', ['key']],
            ['IDX_UPLOADS_USER_ID', ['userId']],
            ['IDX_UPLOADS_CREATED_AT', ['created_at']],
        ] as [string, string[]][]) {
            await queryRunner.createIndex(
                'uploads',
                new TableIndex({ name, columnNames: cols }),
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('uploads');
    }
}
