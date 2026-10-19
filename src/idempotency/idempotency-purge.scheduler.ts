import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IdempotencyService } from "./idempotency.service";

/**
 * Schedules IdempotencyService.purgeExpired() to run periodically.
 *
 * Previously purgeExpired() existed but nothing ever called it, so expired
 * rows only disappeared opportunistically when IdempotencyService.find()
 * happened to be called for that exact id (#1970). This runs the purge daily
 * so the table doesn't grow unbounded from rows nobody ever re-reads.
 */
@Injectable()
export class IdempotencyPurgeScheduler {
  private readonly logger = new Logger(IdempotencyPurgeScheduler.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron(): Promise<void> {
    await this.idempotencyService.purgeExpired();
    this.logger.log("Purged expired idempotency records");
  }
}
