import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/** Header used to propagate a request/correlation ID across services. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Conservative pattern for a caller-supplied request id. */
export const REQUEST_ID_PATTERN = /^[\w-]{8,128}$/;

export interface RequestWithId extends Request {
  requestId: string;
}

/**
 * RequestIdMiddleware
 *
import { randomUUID } from 'crypto';

/** Header used to propagate a request/correlation ID across services. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Conservative pattern for a caller-supplied request id. */
export const REQUEST_ID_PATTERN = /^[\w-]{8,128}$/;

export interface RequestWithId extends Request {
  requestId: string;
}
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
    const incoming = req.headers[REQUEST_ID_HEADER];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId = isValidRequestId(candidate) ? candidate : randomUUID();

    (req as Request & { requestId?: string }).requestId = requestId;
    res.setHeader('x-request-id', requestId);

    next();
  }
}
