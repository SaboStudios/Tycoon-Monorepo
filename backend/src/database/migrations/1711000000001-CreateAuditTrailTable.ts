import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAuditTrailTable1711000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'audit_trails',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'userId',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'action',
                        type: 'varchar',
                        length: '50',
                    },
                    {
                        name: 'userEmail',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'performedBy',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'performedByEmail',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'changes',
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
                        name: 'reason',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        await queryRunner.createIndex(
            'audit_trails',
            new TableIndex({
                name: 'idx_audit_trails_userId',
                columnNames: ['userId'],
            }),
        );

        await queryRunner.createIndex(
            'audit_trails',
            new TableIndex({
                name: 'idx_audit_trails_action',
                columnNames: ['action'],
            }),
        );

        await queryRunner.createIndex(
            'audit_trails',
            new TableIndex({
                name: 'idx_audit_trails_createdAt',
                columnNames: ['created_at'],
            }),
        );

        await queryRunner.createIndex(
            'audit_trails',
            new TableIndex({
                name: 'idx_audit_trails_userId_action',
                columnNames: ['userId', 'action'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('audit_trails');
    }
}
