import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { LoggerService } from '../logger/logger.service';

/** Header used to propagate a trace/correlation ID across services. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * RequestLoggerInterceptor — SW-BE-025
 *
 * Attaches a correlation ID to every request (reads the incoming header or
 * generates a new UUID), logs structured request/response metadata at the
 * `http` level, and forwards the ID in the response header so callers can
 * correlate logs end-to-end.
 *
 * Sensitive paths (auth, tokens) are excluded from body logging.
 * No PII or secret fields are emitted — the Winston sanitize format provides
 * a second layer of defence.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // Skip internal scrape / health endpoints to avoid log noise.
    const path: string = req.path ?? '';
    if (path === '/metrics' || path.startsWith('/health')) {
      return next.handle();
    }

    const correlationId: string =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined) ?? randomUUID();

    // Attach to request so downstream code can read it.
    (req as Request & { correlationId: string }).correlationId = correlationId;

    // Echo back in response.
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    const startNs = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs =
            Number(process.hrtime.bigint() - startNs) / 1_000_000;
          this.logger.http('HTTP request completed', {
            correlationId,
            method: req.method,
            path,
            statusCode: res.statusCode,
            durationMs: Math.round(durationMs),
            userAgent: req.headers['user-agent'],
          });
        },
        error: (err: unknown) => {
          const durationMs =
            Number(process.hrtime.bigint() - startNs) / 1_000_000;
          this.logger.http('HTTP request errored', {
            correlationId,
            method: req.method,
            path,
            statusCode: res.statusCode,
            durationMs: Math.round(durationMs),
            error:
              err instanceof Error ? err.message : 'Unknown error',
          });
        },
      }),
    );
  }
}
