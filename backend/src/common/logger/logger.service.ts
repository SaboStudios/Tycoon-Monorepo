import {
  Injectable,
  Inject,
  LoggerService as NestLoggerService,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

/**
 * Custom Logger Service wrapping Winston
 * Provides a consistent interface for logging throughout the application
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * Log a message at the 'log' level (maps to 'info')
   */
  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  /**
   * Log a message at the 'error' level
   */
  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  /**
   * Log a message at the 'warn' level
   */
  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  /**
   * Log a message at the 'debug' level
   */
  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  /**
   * Log a message at the 'verbose' level
   */
  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  /**
   * Log HTTP request/response information
   */
  http(message: string, meta?: Record<string, any>) {
    this.logger.log('http', message, meta);
  }

  /**
   * Log with custom metadata
   */
  logWithMeta(level: string, message: string, meta: Record<string, any>) {
    this.logger.log(level, message, meta);
  }

  /**
   * Get the underlying Winston logger instance
   */
  getWinstonLogger(): Logger {
    return this.logger;
  }
}
