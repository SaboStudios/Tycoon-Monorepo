import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateWaitlistTable1740349960000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'waitlist',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'wallet_address',
                        type: 'varchar',
                        length: '255',
                        isUnique: true,
                        isNullable: true,
                    },
                    {
                        name: 'email_address',
                        type: 'varchar',
                        length: '255',
                        isUnique: true,
                        isNullable: true,
                    },
                    {
                        name: 'telegram_username',
                        type: 'varchar',
                        length: '100',
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('waitlist');
    }
}
