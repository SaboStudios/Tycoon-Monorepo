import { Injectable, LoggerService, Scope } from '@nestjs/common';

export interface StructuredLogContext {
  requestId?: string;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLoggerService implements LoggerService {
  private write(level: string, message: unknown, context?: StructuredLogContext): void {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context ?? {}),
    };

    const line = JSON.stringify(entry);

    switch (level) {
      case 'error':
        // eslint-disable-next-line no-console
        console.error(line);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(line);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(line);
        break;
    }
  }

  log(message: unknown, context?: StructuredLogContext): void {
    this.write('log', message, context);
  }

  error(message: unknown, context?: StructuredLogContext): void {
    this.write('error', message, context);
  }

  warn(message: unknown, context?: StructuredLogContext): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: StructuredLogContext): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: StructuredLogContext): void {
    this.write('verbose', message, context);
  }
}
