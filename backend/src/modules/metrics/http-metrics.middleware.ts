import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { HttpMetricsService } from './http-metrics.service';
import { classifyHttpRouteGroup } from './route-group';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(
    private readonly httpMetrics: HttpMetricsService,
    private readonly config: ConfigService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip internal routes (/metrics, /health/*) and honour the feature flag.
    // classifyHttpRouteGroup gives a stable low-cardinality label; 'internal'
    // means "do not record latency histograms or count scrapes as traffic".
    if (
      classifyHttpRouteGroup(req.path) === 'internal' ||
      !this.config.get<boolean>('REQUEST_LOGGING_ENABLED', true)
    ) {
      next();
      return;
    }

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      this.httpMetrics.recordRequest(
        req.method,
        req.path,
        res.statusCode,
        durationSec,
      );
    });
    next();
  }
}
