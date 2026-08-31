import { Injectable } from '@nestjs/common';
import { Counter } from 'prom-client';
import { HttpMetricsService } from '../metrics/http-metrics.service';

/**
 * JobsMetricsService (SW-BE issue #1314)
 *
 * Tracks failed BullMQ jobs so operators can see failure counts on the
 * existing Prometheus /metrics endpoint without a separate scrape target.
 * Registers into HttpMetricsService's shared Registry so both sets of
 * metrics are exposed together.
 */
@Injectable()
export class JobsMetricsService {
  private readonly jobsFailedTotal: Counter;

  constructor(private readonly httpMetrics: HttpMetricsService) {
    this.jobsFailedTotal = new Counter({
      name: 'tycoon_jobs_failed_total',
      help: 'Total number of background jobs that failed, by queue and job name',
      labelNames: ['queue', 'job_name'],
      registers: [this.httpMetrics.registry],
    });
  }

  recordFailure(queue: string, jobName: string): void {
    this.jobsFailedTotal.inc({ queue, job_name: jobName || 'unknown' });
  }

  async getFailedCount(queue: string, jobName: string): Promise<number> {
    const metric = await this.jobsFailedTotal.get();
    const match = metric.values.find(
      (v) => v.labels.queue === queue && v.labels.job_name === jobName,
    );
    return match?.value ?? 0;
  }
}
