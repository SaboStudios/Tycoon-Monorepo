import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { IdempotencyHelper } from '@/common/idempotency';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const REPLAY_HEADER = 'x-idempotency-replayed';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyHelper) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      headers: Record<string, string | undefined>;
    }>();
    const res = context.switchToHttp().getResponse<{
      setHeader: (name: string, value: string) => void;
    }>();

    if (!MUTATING_METHODS.has(req.method)) {
      return next.handle();
    }

    const idempotencyKey =
      req.headers[IDEMPOTENCY_HEADER] ?? req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      return next.handle();
    }

    const existing = await this.idempotency.get(idempotencyKey);

    if (existing?.status === 'in_flight') {
      throw new ConflictException('Request is still being processed');
    }

    if (existing?.status === 'complete') {
      res.setHeader(REPLAY_HEADER, 'true');
      return new Observable((subscriber) => {
        subscriber.next(existing.response);
        subscriber.complete();
      });
    }

    const claimed = await this.idempotency.claim(idempotencyKey);
    if (!claimed) {
      throw new ConflictException('Request is still being processed');
    }

    return next.handle().pipe(
      tap(async (response: unknown) => {
        await this.idempotency.complete(idempotencyKey, response);
      }),
      catchError((err: unknown) => {
        void this.idempotency.fail(idempotencyKey);
        return throwError(() =>
          err instanceof HttpException
            ? err
            : new HttpException(
                'Internal server error',
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
        );
      }),
    );
  }
}
