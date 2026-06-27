import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { HttpMetricsService } from './http-metrics.service';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(
    private readonly httpMetrics: HttpMetricsService,
    private readonly config: ConfigService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip the metrics scrape endpoint itself, and honour the feature flag.
    if (
      req.path === '/metrics' ||
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
