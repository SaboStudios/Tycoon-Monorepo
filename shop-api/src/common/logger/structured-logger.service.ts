import { ConsoleLogger, Injectable, LoggerService } from '@nestjs/common';

/**
 * StructuredLoggerService
 *
 * Emits single-line JSON logs in production (easy to ingest by log
 * aggregators) and falls back to Nest's readable console format outside
 * production, so local `npm run start:dev` output stays human-friendly.
 *
 * Every entry includes: timestamp, level, message, context, and — when
 * supplied via `meta.requestId` — the request ID for cross-request tracing.
 *
 * IMPORTANT: never pass raw idempotency keys into `meta`. Callers must mask
 * them first (see IdempotencyService#mask) — this logger does not attempt
 * to detect or redact secrets on its own.
 */
@Injectable()
export class StructuredLoggerService extends ConsoleLogger implements LoggerService {
  private get isJson(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    if (!this.isJson) {
      super[level as 'log'](message as string, ...(optionalParams as []));
      return;
    }

    const meta = optionalParams.find(
      (p) => typeof p === 'object' && p !== null,
    ) as Record<string, unknown> | undefined;
    const context = optionalParams.find((p) => typeof p === 'string') as
      | string
      | undefined;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context: context ?? this.context,
      ...meta,
    };

    // Single-line JSON — one entry per log call.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }
}
