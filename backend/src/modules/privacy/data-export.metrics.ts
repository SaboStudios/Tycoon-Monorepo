import { Injectable } from '@nestjs/common';
import { Counter } from 'prom-client';
import { HttpMetricsService } from '../metrics/http-metrics.service';

/** Outcome of POST /users/me/data-export. Coarse, fixed set — no user labels. */
export type DataExportRequestOutcome =
  | 'created'
  | 'reused'
  | 'disabled'
  | 'enqueue_failed'
  | 'step_up_required';

/** Terminal worker outcome for an export job. */
export type DataExportJobOutcome = 'ready' | 'failed';

/**
 * Prometheus counters for the user data export path (#1766), exposed on the
 * shared /metrics registry. Labels are low-cardinality enums only: never user
 * ids, emails, wallet addresses or tokens.
 */
@Injectable()
export class DataExportMetrics {
  private readonly requests: Counter<'outcome'>;
  private readonly jobs: Counter<'outcome'>;

  constructor(metrics: HttpMetricsService) {
    this.requests = new Counter({
      name: 'tycoon_data_export_requests_total',
      help: 'User data export requests by outcome',
      labelNames: ['outcome'],
      registers: [metrics.registry],
    });
    this.jobs = new Counter({
      name: 'tycoon_data_export_jobs_total',
      help: 'User data export jobs finished by the worker, by outcome',
      labelNames: ['outcome'],
      registers: [metrics.registry],
    });
  }

  recordRequest(outcome: DataExportRequestOutcome): void {
    this.requests.inc({ outcome });
  }

  recordJob(outcome: DataExportJobOutcome): void {
    this.jobs.inc({ outcome });
  }
}
