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
import { IdempotencyService } from './idempotency.service';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const REPLAY_HEADER = 'x-idempotency-replayed';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
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

    const idempotencyKey = req.headers[IDEMPOTENCY_HEADER];
    if (!idempotencyKey) {
      return next.handle();
    }

    const existing = await this.idempotency.get(idempotencyKey);

    if (existing?.status === 'processing') {
      throw new ConflictException('Request is still being processed');
    }

    if (existing?.status === 'complete') {
      res.setHeader(REPLAY_HEADER, 'true');
      return new Observable((subscriber) => {
        subscriber.next(existing.response);
        subscriber.complete();
      });
    }

    await this.idempotency.markProcessing(idempotencyKey);

    return next.handle().pipe(
      tap(async (response: unknown) => {
        await this.idempotency.markComplete(idempotencyKey, response);
      }),
      catchError((err: unknown) => {
        void this.idempotency.delete(idempotencyKey);
        return throwError(() => err instanceof HttpException
          ? err
          : new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR));
      }),
    );
  }
}
