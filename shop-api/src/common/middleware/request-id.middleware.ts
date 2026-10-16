import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * RequestIdMiddleware
 *
 * Ensures every request carries a request id for cross-request tracing.
 *
 * When an inbound `x-request-id` header is present and well-formed it is
 * reused verbatim so that a request originating in the backend and proxied
 * to shop-api keeps a single, correlated id end-to-end. When the header is
 * absent or malformed a fresh id is generated.
 *
 * The chosen id is exposed on `req.requestId` (consumed by
 * StructuredLoggerService and HttpExceptionFilter) and echoed back on the
 * `x-request-id` response header.
 */

// Guard against header injection / unbounded values: only accept a
// conservative charset and a bounded length.
const REQUEST_ID_MAX_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._~-]+$/;

export function isValidRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= REQUEST_ID_MAX_LENGTH &&
    REQUEST_ID_PATTERN.test(value)
  );
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers['x-request-id'];
    const requestId = isValidRequestId(inbound) ? inbound : randomUUID();

    (req as Request & { requestId?: string }).requestId = requestId;
    res.setHeader('x-request-id', requestId);

    next();
  }
}
