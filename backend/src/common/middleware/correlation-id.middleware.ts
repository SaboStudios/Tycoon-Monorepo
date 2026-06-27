import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { LoggerService } from '../logger/logger.service';

export const CORRELATION_ID_HEADER = 'x-request-id';

/**
 * CorrelationIdMiddleware — SW-BE-025
 *
 * Reads X-Request-Id from the incoming request (forwarded by a gateway/client),
 * or generates a fresh UUID if absent. The value is:
 *   1. Echoed back in the response header.
 *   2. Attached to req as (req as any).correlationId for downstream logging.
 *   3. Logged at http level alongside method + path.
 *
 * No PII is captured; the correlation ID is opaque.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined) ?? '';
    const correlationId = incoming.trim() || randomUUID();

    // Attach for downstream use (e.g. interceptors, services)
    (req as Request & { correlationId: string }).correlationId = correlationId;

    // Echo back so callers can correlate their own logs
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    this.logger.http(`${req.method} ${req.path}`, {
      correlationId,
      method: req.method,
      path: req.path,
    });

    next();
  }
}
