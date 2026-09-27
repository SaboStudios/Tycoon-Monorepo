import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LedgerReconciliationService } from './ledger-reconciliation.service';

@Injectable()
export class LedgerReconciliationScheduler {
  private readonly logger = new Logger(LedgerReconciliationScheduler.name);

  constructor(
    private readonly reconciliationService: LedgerReconciliationService,
    private readonly configService: ConfigService,
  ) {}

  /** Runs every night at 02:00 UTC */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runNightlyReconciliation(): Promise<void> {
    const isDryRun =
      this.configService.get<string>('NODE_ENV') === 'staging' ||
      this.configService.get<string>('RECONCILIATION_DRY_RUN') === 'true';

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1);

    this.logger.log(
      `Nightly reconciliation triggered. dryRun=${isDryRun}`,
    );

    try {
      const report = await this.reconciliationService.reconcile(
        startDate,
        endDate,
        isDryRun,
      );

      this.logger.log(
        `Nightly reconciliation done. runId=${report.runId} ` +
          `discrepancies=${report.discrepancies.length} ` +
          `alertBreached=${report.alertThresholdBreached}`,
      );
    } catch (err) {
      this.logger.error('Nightly reconciliation failed', err);
    }
  }
}
