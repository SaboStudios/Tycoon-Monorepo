import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { redactUrl } from '../logger/redact-url';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
    }>();
    const { method } = request;
    const url = redactUrl(request.url);
    const now = Date.now();

    return next
      .handle()
      .pipe(
        tap(() => this.logger.log(`${method} ${url} ${Date.now() - now}ms`)),
      );
  }
}
