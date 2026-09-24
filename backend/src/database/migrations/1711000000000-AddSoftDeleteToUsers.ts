import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSoftDeleteToUsers1711000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'users',
            new TableColumn({
                name: 'deleted_at',
                type: 'timestamp',
                isNullable: true,
                default: null,
            }),
        );

        await queryRunner.query(
            `CREATE INDEX idx_users_deleted_at ON users(deleted_at)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX idx_users_deleted_at`);
        await queryRunner.dropColumn('users', 'deleted_at');
    }
}
