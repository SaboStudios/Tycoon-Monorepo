import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import {
  classifyHttpRouteGroup,
  httpStatusClass,
} from './route-group';

/** HTTP handler latency buckets (seconds) — tuned for API latency (p50–p99). */
const HTTP_DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

@Injectable()
export class HttpMetricsService {
  readonly registry = new Registry();

  private readonly requestsTotal: Counter;
  private readonly requestDuration: Histogram;

  constructor() {
    const commonLabelNames = ['method', 'route_group'] as const;

    this.requestsTotal = new Counter({
      name: 'tycoon_http_requests_total',
      help: 'Total HTTP requests by method, route group, and status class',
      labelNames: [...commonLabelNames, 'status_class'],
      registers: [this.registry],
    });

    this.requestDuration = new Histogram({
      name: 'tycoon_http_request_duration_seconds',
      help: 'HTTP request duration in seconds (handler time; no user id labels)',
      labelNames: [...commonLabelNames],
      buckets: HTTP_DURATION_BUCKETS,
      registers: [this.registry],
    });
  }

  recordRequest(
    method: string,
    path: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const routeGroup = classifyHttpRouteGroup(path);
    const statusClass = httpStatusClass(statusCode);
    const m = method.toUpperCase();

    this.requestsTotal.inc({
      method: m,
      route_group: routeGroup,
      status_class: statusClass,
    });

    if (routeGroup !== 'internal') {
      this.requestDuration.observe(
        { method: m, route_group: routeGroup },
        durationSeconds,
      );
    }
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
