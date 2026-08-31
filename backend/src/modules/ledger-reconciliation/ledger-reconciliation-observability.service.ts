import { Injectable, Logger } from '@nestjs/common';
import { Gauge, Counter } from 'prom-client';

/**
 * Observability for ledger reconciliation drift monitoring.
 * Exports Prometheus metrics to alert on financial discrepancies.
 */
@Injectable()
export class LedgerReconciliationObservabilityService {
  private readonly logger = new Logger(
    LedgerReconciliationObservabilityService.name,
  );

  // Gauge for current drift percentage (0-100)
  private readonly driftPercent: Gauge<string>;
  // Counter for total reconciliation runs
  private readonly reconciliationRunsTotal: Counter<string>;

  // Alert threshold: 5% (per issue requirements)
  private readonly ALERT_THRESHOLD_PERCENT = 5;

  constructor() {
    this.driftPercent = new Gauge({
      name: 'ledger_reconciliation_drift_percent',
      help: 'Percentage of ledger records with discrepancies (no PII labels)',
      labelNames: [],
    });

    this.reconciliationRunsTotal = new Counter({
      name: 'ledger_reconciliation_runs_total',
      help: 'Total number of reconciliation runs (dry-run + production)',
      labelNames: ['mode'],
    });
  }

  /**
   * Record a reconciliation run's results and export metrics.
   * Called after each reconciliation completes.
   */
  recordReconciliation(params: {
    driftPercent: number;
    dryRun: boolean;
    discrepancyCount: number;
    ledgerCount: number;
  }): void {
    const { driftPercent, dryRun, discrepancyCount, ledgerCount } = params;

    // Export drift gauge
    this.driftPercent.set(driftPercent);

    // Record run count
    this.reconciliationRunsTotal.inc({ mode: dryRun ? 'dry_run' : 'production' });

    // Log alert if threshold breached
    if (driftPercent > this.ALERT_THRESHOLD_PERCENT) {
      this.logger.warn(
        `ALERT: reconciliation drift ${driftPercent.toFixed(2)}% ` +
          `exceeds threshold of ${this.ALERT_THRESHOLD_PERCENT}% ` +
          `(${discrepancyCount}/${ledgerCount} records)`,
        { driftPercent, discrepancyCount, ledgerCount },
      );
    }
  }

  /**
   * Reset drift gauge to zero (e.g., for stub providers in tests).
   */
  resetDrift(): void {
    this.driftPercent.set(0);
  }
}
