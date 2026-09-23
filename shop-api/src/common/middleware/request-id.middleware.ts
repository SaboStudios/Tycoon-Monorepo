import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/** Header used to propagate a request/correlation ID across services. */
export const REQUEST_ID_HEADER = 'x-request-id';

export interface RequestWithId extends Request {
  requestId: string;
}

/**
 * RequestIdMiddleware
 *
 * Attaches a request ID to every incoming request (reuses the caller's
 * `x-request-id` header when present, otherwise generates a new UUID) and
 * echoes it back on the response so callers can correlate logs end-to-end
 * with shop-api, matching the backend's correlation ID behaviour.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId =
      (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();

    (req as RequestWithId).requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
