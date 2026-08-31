import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

export class AddWebhookEventsUniqueConstraint1771000000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createUniqueConstraint(
      'webhook_events',
      new TableUnique({
        columnNames: ['eventId', 'source'],
        name: 'UQ_WEBHOOK_EVENTS_EVENT_ID_SOURCE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint(
      'webhook_events',
      'UQ_WEBHOOK_EVENTS_EVENT_ID_SOURCE',
    );
  }
}
