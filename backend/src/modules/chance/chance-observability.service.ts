import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import { LoggerService } from '../../common/logger/logger.service';

const ROLL_DURATION_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1];

@Injectable()
export class ChanceObservabilityService {
  readonly registry = new Registry();

  private readonly chanceRollsTotal: Counter;
  private readonly chanceRollDuration: Histogram;

  constructor(private readonly logger: LoggerService) {
    this.chanceRollsTotal = new Counter({
      name: 'chance_rolls_total',
      help: 'Total chance card rolls by outcome type',
      labelNames: ['outcome'],
      registers: [this.registry],
    });

    this.chanceRollDuration = new Histogram({
      name: 'chance_roll_duration_seconds',
      help: 'Time spent drawing a chance card',
      labelNames: ['outcome'],
      buckets: ROLL_DURATION_BUCKETS,
      registers: [this.registry],
    });
  }

  logOperationStart(action: string, input: Record<string, unknown>): void {
    this.logger.logWithMeta('info', action, { action, input });
  }

  logOperationSuccess(
    action: string,
    durationMs: number,
    meta: Record<string, unknown> = {},
  ): void {
    this.logger.logWithMeta('info', action, {
      action,
      result: 'success',
      duration_ms: durationMs,
      ...meta,
    });
  }

  logOperationError(action: string, error: Error): void {
    this.logger.logWithMeta('error', action, {
      action,
      error: error.message,
    });
  }

  recordRoll(outcome: string, durationMs: number): void {
    this.chanceRollsTotal.inc({ outcome });
    this.chanceRollDuration.observe({ outcome }, durationMs / 1000);
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
