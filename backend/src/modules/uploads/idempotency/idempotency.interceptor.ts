import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  ConflictException,
} from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { catchError, mergeMap, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { Reflector } from '@nestjs/core';
import {
  IDEMPOTENCY_KEY_OPTIONS,
  IdempotencyOptions,
} from './idempotency.constants';
import { IdempotencyHelper } from '@/common/idempotency';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
    private readonly idempotencyHelper: IdempotencyHelper,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const options =
      this.reflector.get<IdempotencyOptions>(
        IDEMPOTENCY_KEY_OPTIONS,
        context.getHandler(),
      ) || {};

    if (!this.isIdempotentMethod(request.method)) {
      return next.handle();
    }

    // Generate idempotency key using uploads-specific logic
    const idempotencyKey = this.idempotencyService.generateKey(request, options);

    // Check if this request has been processed before using shared helper
    const existingRecord = await this.idempotencyHelper.get(idempotencyKey);

    if (existingRecord) {
      if (existingRecord.status === 'in_flight') {
        throw new ConflictException({
          error: 'IDEMPOTENCY_IN_PROGRESS',
          message: 'Request is currently being processed',
        });
      }

      // Return cached response
      if (existingRecord.status === 'complete' && existingRecord.response) {
        const cachedResp = existingRecord.response as any;
        if (cachedResp.headers) {
          Object.entries(cachedResp.headers).forEach(
            ([key, value]) => {
              if (!key.toLowerCase().startsWith('x-')) {
                response.set(key, value);
              }
            },
          );
        }

        response.set('X-Idempotent-Replayed', 'true');
        response.status(cachedResp.statusCode || HttpStatus.OK);

        return new Observable((subscriber) => {
          subscriber.next(cachedResp.body ?? null);
          subscriber.complete();
        });
      }
    }

    // Claim the key using shared helper
    const claimed = await this.idempotencyHelper.claim(idempotencyKey, options);
    if (!claimed) {
      throw new ConflictException({
        error: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'Request is currently being processed',
      });
    }

    return next.handle().pipe(
      tap(async (data) => {
        const statusCode = response.statusCode || HttpStatus.OK;
        const cached = {
          statusCode,
          headers: response.getHeaders() as Record<string, string>,
          body: data,
        };
        await this.idempotencyHelper.complete(idempotencyKey, cached, options);
        response.set('X-Idempotent', 'true');
      }),
      catchError(async (error) => {
        // Fail the claim to allow retries
        await this.idempotencyHelper.fail(idempotencyKey);
        response.set('X-Idempotent', 'true');
        return throwError(() => error);
      }),
    );
  }

  private isIdempotentMethod(method: string): boolean {
    const idempotentMethods = [
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
    ];
    return idempotentMethods.includes(method.toUpperCase());
  }
}
