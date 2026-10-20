import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateWebhookEventsTable1745600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'webhook_events',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'eventId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'eventType',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'source',
            type: 'varchar',
            length: '50',
            default: "'stripe'",
          },
          {
            name: 'payload',
            type: 'jsonb',
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

    for (const [name, cols] of [
      ['IDX_WEBHOOK_EVENTS_EVENT_ID', ['eventId']],
      ['IDX_WEBHOOK_EVENTS_EVENT_TYPE', ['eventType']],
      ['IDX_WEBHOOK_EVENTS_SOURCE', ['source']],
      ['IDX_WEBHOOK_EVENTS_CREATED_AT', ['created_at']],
    ] as [string, string[]][]) {
      await queryRunner.createIndex(
        'webhook_events',
        new TableIndex({ name, columnNames: cols }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('webhook_events');
  }
}
