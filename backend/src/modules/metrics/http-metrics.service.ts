import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import { DataSource } from 'typeorm';
import {
  classifyHttpRouteGroup,
  httpStatusClass,
} from './route-group';

/** HTTP handler latency buckets (seconds) — tuned for API latency (p50–p99). */
const HTTP_DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

/** Threshold: alert when waiting connections exceed this fraction of pool size. */
const POOL_EXHAUSTION_RATIO_THRESHOLD = 0.8;

@Injectable()
export class HttpMetricsService {
  readonly registry = new Registry();

  private readonly requestsTotal: Counter;
  private readonly requestDuration: Histogram;
  private readonly dbPoolTotal: Gauge;
  private readonly dbPoolIdle: Gauge;
  private readonly dbPoolWaiting: Gauge;
  private readonly dbPoolExhaustionTotal: Counter;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
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

    this.dbPoolTotal = new Gauge({
      name: 'tycoon_db_pool_total',
      help: 'Total connections in the TypeORM pool (idle + active)',
      registers: [this.registry],
    });

    this.dbPoolIdle = new Gauge({
      name: 'tycoon_db_pool_idle',
      help: 'Idle connections in the TypeORM pool',
      registers: [this.registry],
    });

    this.dbPoolWaiting = new Gauge({
      name: 'tycoon_db_pool_waiting',
      help: 'Requests waiting for a free connection (pool exhaustion indicator)',
      registers: [this.registry],
    });

    this.dbPoolExhaustionTotal = new Counter({
      name: 'tycoon_db_pool_exhaustion_total',
      help: 'Number of times the pool waiting queue exceeded the exhaustion threshold',
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

  /** Snapshot pool stats from the underlying pg Pool and update gauges. */
  collectPoolMetrics(): void {
    // TypeORM exposes the underlying pg Pool via driver.master
    const pool = (this.dataSource.driver as unknown as { master?: { totalCount?: number; idleCount?: number; waitingCount?: number } }).master;
    if (!pool) return;

    const total = pool.totalCount ?? 0;
    const idle = pool.idleCount ?? 0;
    const waiting = pool.waitingCount ?? 0;
    const poolSize: number =
      (this.dataSource.options as { poolSize?: number }).poolSize ?? 5;

    this.dbPoolTotal.set(total);
    this.dbPoolIdle.set(idle);
    this.dbPoolWaiting.set(waiting);

    if (waiting / poolSize >= POOL_EXHAUSTION_RATIO_THRESHOLD) {
      this.dbPoolExhaustionTotal.inc();
    }
  }

  async getMetricsText(): Promise<string> {
    this.collectPoolMetrics();
    return this.registry.metrics();
  }
}
