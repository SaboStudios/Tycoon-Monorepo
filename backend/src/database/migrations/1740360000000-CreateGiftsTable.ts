import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateGiftsTable1740360000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for gift status
    await queryRunner.query(`
      CREATE TYPE "gift_status_enum" AS ENUM (
        'pending', 'accepted', 'rejected', 'expired', 'cancelled'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'gifts',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'sender_id',
            type: 'int',
          },
          {
            name: 'receiver_id',
            type: 'int',
          },
          {
            name: 'shop_item_id',
            type: 'int',
          },
          {
            name: 'quantity',
            type: 'int',
            default: 1,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'expiration',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'accepted_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rejected_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'nft_contract_address',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'nft_token_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'chain',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'transaction_hash',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
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

    // Create indexes for common query patterns
    await queryRunner.createIndex(
      'gifts',
      new TableIndex({
        name: 'IDX_GIFTS_SENDER_STATUS',
        columnNames: ['sender_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'gifts',
      new TableIndex({
        name: 'IDX_GIFTS_RECEIVER_STATUS',
        columnNames: ['receiver_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'gifts',
      new TableIndex({
        name: 'IDX_GIFTS_STATUS_EXPIRATION',
        columnNames: ['status', 'expiration'],
      }),
    );

    await queryRunner.createIndex(
      'gifts',
      new TableIndex({
        name: 'IDX_GIFTS_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'gifts',
      new TableForeignKey({
        columnNames: ['sender_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'gifts',
      new TableForeignKey({
        columnNames: ['receiver_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'gifts',
      new TableForeignKey({
        columnNames: ['shop_item_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'shop_items',
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('gifts');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('gifts', foreignKey);
      }
    }

    await queryRunner.dropTable('gifts');
    await queryRunner.query(`DROP TYPE IF EXISTS "gift_status_enum"`);
  }
}
