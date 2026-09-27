import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Observable, from, throwError } from "rxjs";
import { switchMap, tap, catchError } from "rxjs/operators";
import { Request, Response } from "express";
import { IdempotencyService } from "./idempotency.service";

export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

/**
 * Apply to any mutating route to enable idempotency.
 *
 * Client usage:
 *   POST /admin/users/:id/reset-password
 *   Idempotency-Key: <uuid-v4>          ← unique per logical operation
 *   Content-Type: application/json
 *
 * Rules:
 *   - Same key + same body  → 200/201 with the original stored response.
 *   - Same key + diff body  → 409 Conflict.
 *   - No header             → request proceeds normally (no idempotency).
 *   - Key expires after 24 h; after that a new request is treated as fresh.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const key = req.headers[IDEMPOTENCY_KEY_HEADER] as string | undefined;
    if (!key) return next.handle();

    const id = this.idempotencyService.buildId(req.method, req.path, key);
    const payloadHash = this.idempotencyService.hashPayload(req.body);

    return from(this.idempotencyService.find(id)).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            throw new ConflictException(
              "Idempotency-Key reused with a different request body",
            );
          }
          // Replay stored response
          res.status(existing.statusCode);
          return from([existing.response]);
        }

        // First time — execute handler then persist outcome
        return next.handle().pipe(
          tap(async (body) => {
            const statusCode = res.statusCode || HttpStatus.OK;
            await this.idempotencyService.store(
              id,
              payloadHash,
              statusCode,
              body as Record<string, unknown>,
            );
          }),
          catchError((err) => {
            // Do not cache error responses
            return throwError(() => err);
          }),
        );
      }),
    );
  }
}
