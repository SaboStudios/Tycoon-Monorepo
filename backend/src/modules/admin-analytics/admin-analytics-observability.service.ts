import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import { LoggerService } from '../../common/logger/logger.service';

const ADMIN_ANALYTICS_DURATION_BUCKETS = [
  0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
];

@Injectable()
export class AdminAnalyticsObservabilityService {
  readonly registry = new Registry();

  private readonly analyticsRequestsTotal: Counter<string>;
  private readonly analyticsRequestDuration: Histogram<string>;

  constructor(private readonly logger: LoggerService) {
    this.analyticsRequestsTotal = new Counter({
      name: 'tycoon_admin_analytics_requests_total',
      help: 'Total admin analytics requests by endpoint and status',
      labelNames: ['endpoint', 'status'],
      registers: [this.registry],
    });

    this.analyticsRequestDuration = new Histogram({
      name: 'tycoon_admin_analytics_request_duration_seconds',
      help: 'Duration of admin analytics requests',
      labelNames: ['endpoint'],
      buckets: ADMIN_ANALYTICS_DURATION_BUCKETS,
      registers: [this.registry],
    });
  }

  recordRequest(endpoint: string, success: boolean, durationMs: number): void {
    const status = success ? 'success' : 'failure';

    this.analyticsRequestsTotal.inc({ endpoint, status }, 1);
    this.analyticsRequestDuration.observe({ endpoint }, durationMs / 1000);

    this.logger.debug(
      `Admin analytics request completed: ${endpoint} (${status})`,
      'AdminAnalyticsObservability',
    );
  }

  logEndpoint(endpoint: string, message: string, meta?: Record<string, unknown>): void {
    this.logger.logWithMeta('info', message, {
      endpoint,
      ...meta,
    });
  }
}
