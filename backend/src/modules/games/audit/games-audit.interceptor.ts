import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { GamesAuditService } from './games-audit.service';

/**
 * HTTP request context extracted for audit logging.
 */
interface HttpAuditContext {
  /** HTTP method (GET, POST, PATCH, etc.) */
  method: string;
  /** Route path */
  path: string;
  /** User ID from JWT token */
  userId?: number;
  /** User role from JWT token */
  userRole?: string;
  /** IP address of the client */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Request duration in milliseconds */
  duration: number;
  /** HTTP status code */
  statusCode?: number;
  /** Error message if request failed */
  error?: string;
}

/**
 * NestJS interceptor for automatic HTTP-level audit capture.
 * 
 * Captures request context (user, IP, user agent) and response metadata
 * (status, duration) for all game endpoints. Integrates with GamesAuditService
 * for structured audit logging.
 * 
 * Features:
 * - Extracts user context from JWT tokens
 * - Captures IP address from X-Forwarded-For or remoteAddress
 * - Calculates request duration
 * - Handles both successful and failed requests
 * - Non-blocking: audit logging doesn't block response
 * 
 * Usage:
 * ```typescript
 * @UseInterceptors(GamesAuditInterceptor)
 * @Controller('games')
 * export class GamesController { ... }
 * ```
 */
@Injectable()
export class GamesAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GamesAuditInterceptor.name);

  constructor(private readonly gamesAuditService: GamesAuditService) {}

  /**
   * Intercept HTTP requests to capture audit context.
   * 
   * @param context - Execution context
   * @param next - Call handler
   * @returns Observable of the response
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (response) => {
        const duration = Date.now() - startTime;
        const auditContext = this.extractAuditContext(
          request,
          response,
          duration,
        );

        // Log audit context asynchronously (don't block response)
        setImmediate(() => {
          this.logHttpRequest(auditContext);
        });
      }),
      catchError(async (error) => {
        const duration = Date.now() - startTime;
        const auditContext = this.extractAuditContext(
          request,
          null,
          duration,
          error,
        );

        // Log audit context asynchronously (don't block error propagation)
        setImmediate(() => {
          this.logHttpRequest(auditContext);
        });

        // Re-throw error to maintain normal error handling flow
        throw error;
      }),
    );
  }

  /**
   * Extract audit context from HTTP request and response.
   * 
   * @param request - Express request object
   * @param response - Response data (if successful)
   * @param duration - Request duration in milliseconds
   * @param error - Error object (if failed)
   * @returns HTTP audit context
   */
  private extractAuditContext(
    request: Request,
    response: any,
    duration: number,
    error?: any,
  ): HttpAuditContext {
    // Extract user context from JWT token (if available)
    const user = (request as any).user;
    const userId = user?.id;
    const userRole = user?.role;

    // Extract IP address (prefer X-Forwarded-For for proxied requests)
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket.remoteAddress ||
      undefined;

    // Extract user agent
    const userAgent = request.headers['user-agent'] || undefined;

    // Extract HTTP method and path
    const method = request.method;
    const path = request.route?.path || request.url;

    // Extract status code
    const statusCode = error ? error.status || 500 : 200;

    return {
      method,
      path,
      userId,
      userRole,
      ipAddress,
      userAgent,
      duration,
      statusCode,
      error: error?.message,
    };
  }

  /**
   * Log HTTP request audit context.
   * 
   * This method is called asynchronously after the response is sent,
   * so it doesn't block the request processing.
   * 
   * @param context - HTTP audit context
   */
  private async logHttpRequest(context: HttpAuditContext): Promise<void> {
    try {
      // For now, just log at debug level
      // In the future, this could be extended to log specific operations
      // based on the route path (e.g., game creation, join, etc.)
      this.logger.debug('HTTP request audit', {
        method: context.method,
        path: context.path,
        userId: context.userId,
        statusCode: context.statusCode,
        duration: context.duration,
        ipAddress: context.ipAddress,
      });
    } catch (error) {
      // Don't let audit logging errors affect the application
      this.logger.error('Failed to log HTTP request audit', {
        error: error.message,
      });
    }
  }
}
