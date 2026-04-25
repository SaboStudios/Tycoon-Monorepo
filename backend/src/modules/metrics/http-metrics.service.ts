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

  // ── Process / runtime metrics (SW-BE-025) ──────────────────────────────────
  private readonly processHeapUsed: Gauge;
  private readonly processHeapTotal: Gauge;
  private readonly processRss: Gauge;
  private readonly processExternalMemory: Gauge;
  private readonly processUptimeSeconds: Gauge;
  private readonly eventLoopLagSeconds: Gauge;

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

    // Process memory gauges
    this.processHeapUsed = new Gauge({
      name: 'tycoon_process_heap_used_bytes',
      help: 'V8 heap used in bytes',
      registers: [this.registry],
    });

    this.processHeapTotal = new Gauge({
      name: 'tycoon_process_heap_total_bytes',
      help: 'V8 heap total allocated in bytes',
      registers: [this.registry],
    });

    this.processRss = new Gauge({
      name: 'tycoon_process_rss_bytes',
      help: 'Resident set size in bytes',
      registers: [this.registry],
    });

    this.processExternalMemory = new Gauge({
      name: 'tycoon_process_external_memory_bytes',
      help: 'External (C++) memory referenced by V8 objects',
      registers: [this.registry],
    });

    this.processUptimeSeconds = new Gauge({
      name: 'tycoon_process_uptime_seconds',
      help: 'Process uptime in seconds',
      registers: [this.registry],
    });

    this.eventLoopLagSeconds = new Gauge({
      name: 'tycoon_event_loop_lag_seconds',
      help: 'Approximate Node.js event-loop lag in seconds (sampled at scrape time)',
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

  /**
   * Snapshot Node.js process metrics (memory, uptime, event-loop lag).
   * Called at scrape time so values are always fresh.
   */
  collectProcessMetrics(): void {
    const mem = process.memoryUsage();
    this.processHeapUsed.set(mem.heapUsed);
    this.processHeapTotal.set(mem.heapTotal);
    this.processRss.set(mem.rss);
    this.processExternalMemory.set(mem.external);
    this.processUptimeSeconds.set(process.uptime());

    // Approximate event-loop lag: schedule a timer and measure how late it fires.
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lagNs = Number(process.hrtime.bigint() - start);
      this.eventLoopLagSeconds.set(lagNs / 1e9);
    });
  }

  async getMetricsText(): Promise<string> {
    this.collectPoolMetrics();
    this.collectProcessMetrics();
    return this.registry.metrics();
  }
}
