import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';
import { RequestWithId } from '../middleware/request-id.middleware';

/**
 * RequestLoggerInterceptor
 *
 * Logs structured request/response metadata (method, path, status, duration,
 * requestId) for every HTTP request. Never logs raw request/response bodies
 * or headers, so idempotency keys and other sensitive values never reach
 * the logs through this path.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<RequestWithId>();
    const res = ctx.getResponse<Response>();

    const path = req.path ?? req.url ?? '';
    if (path === '/health' || path === '/metrics') {
      return next.handle();
    }

    const requestId = req.requestId;
    const startNs = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = this.durationMs(startNs);
          this.logger.log(
            'HTTP request completed',
            JSON.stringify({
              requestId,
              method: req.method,
              path,
              statusCode: res.statusCode,
              durationMs,
            }),
          );
        },
        error: (err: unknown) => {
          const durationMs = this.durationMs(startNs);
          this.logger.error(
            'HTTP request errored',
            JSON.stringify({
              requestId,
              method: req.method,
              path,
              statusCode: res.statusCode,
              durationMs,
              error: err instanceof Error ? err.message : 'Unknown error',
            }),
          );
        },
      }),
    );
  }

  private durationMs(startNs: bigint): number {
    return Math.round(Number(process.hrtime.bigint() - startNs) / 1_000_000);
  }
}
