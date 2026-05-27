import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../logger/logger.service';

/**
 * HTTP Logger Middleware
 * Logs all incoming HTTP requests and their responses
 * Includes request method, URL, status code, response time, and user agent
 */
const DEFAULT_EXCLUDE_PATHS = ['/health', '/metrics'];

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (this.shouldSkip(req.path)) {
      return next();
    }

    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || 'Unknown';
    const startTime = Date.now();

    // Log request
    this.logger.http(`Incoming Request: ${method} ${originalUrl}`, {
      method,
      url: originalUrl,
      ip,
      userAgent,
    });

    // Capture response
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;
      const logLevel = statusCode >= 400 ? 'warn' : 'http';

      const message = `${method} ${originalUrl} ${statusCode} - ${responseTime}ms`;

      this.logger.logWithMeta(logLevel, message, {
        method,
        url: originalUrl,
        statusCode,
        responseTime,
        ip,
        userAgent,
      });
    });

    next();
  }

  private shouldSkip(path: string): boolean {
    const excludePaths =
      process.env.LOG_EXCLUDE_PATHS?.split(',').map((p) => p.trim()) ??
      DEFAULT_EXCLUDE_PATHS;
    return excludePaths.some((prefix) => path.startsWith(prefix));
  }
}
