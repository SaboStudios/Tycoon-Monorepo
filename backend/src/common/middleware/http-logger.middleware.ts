import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../logger/logger.service';
import { redactUrl } from '../logger/redact-url';

/**
 * HTTP Logger Middleware
 * Logs all incoming HTTP requests and their responses
 * Includes request method, URL, status code, response time, and user agent
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, ip, headers } = req;
    // Never log credentials carried in the query string (e.g. ?token=).
    const originalUrl = redactUrl(req.originalUrl);
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
}
