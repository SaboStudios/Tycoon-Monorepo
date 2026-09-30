import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomUUID } from "crypto";

/**
 * Global HTTP exception filter — shop-api.
 *
 * Emits the canonical error envelope defined in docs/API_ERROR_RESPONSE_STANDARDS.md:
 *
 * ```json
 * {
 *   "statusCode": 400,
 *   "message": "Validation failed",
 *   "errors": { "sku": ["sku must be a non-empty string"] },
 *   "correlationId": "req_550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 *
 * Rules:
 *  - No stack traces, DB errors, or secret values in the response body.
 *  - `errors` is populated only for 400/422 validation failures; null otherwise.
 *  - `correlationId` is always present: echoes `x-request-id` / `x-correlation-id`
 *    or generates `req_<uuid>` and echoes it in the `x-correlation-id` response
 *    header so the frontend can correlate even when the body is truncated.
 *  - 5xx are logged server-side with the real error; 4xx are client mistakes.
 *  - `requestId` from RequestIdMiddleware is propagated as correlationId so
 *    purchase tracing is end-to-end (SHOP_PURCHASES_RUNBOOK, ADR-001 §8).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<
      Request & { requestId?: string; correlationId?: string }
    >();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Correlation ID: prefer explicit requestId from middleware, then header, then generate.
    const headerCorrelation =
      (request.headers["x-request-id"] as string) ||
      (request.headers["x-correlation-id"] as string) ||
      (request as any).requestId ||
      (request as any).correlationId;

    const correlationId = this.normalizeCorrelationId(headerCorrelation);

    // Echo correlation ID on the response for frontend error-tracking (Issue #1734).
    response.setHeader("x-correlation-id", correlationId);
    response.setHeader("x-request-id", correlationId);

    // Extract message and structured errors for the canonical shape.
    const { message, errors } = this.extractMessageAndErrors(exception, status);

    // Log 5xx with real error; 4xx are client mistakes, no need to alarm.
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} correlationId=${correlationId}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      errors: errors ?? null,
      correlationId,
    });
  }

  private normalizeCorrelationId(raw?: string): string {
    if (typeof raw === "string" && raw.trim().length > 0) {
      // Accept already-prefixed IDs or raw UUIDs; ensure stable shape.
      const trimmed = raw.trim();
      if (trimmed.startsWith("req_")) return trimmed;
      // If it's a UUID, prefix; otherwise use as-is but sanitize length.
      if (/^[0-9a-f-]{36}$/i.test(trimmed)) return `req_${trimmed}`;
      if (trimmed.length <= 128) return trimmed;
    }
    return `req_${randomUUID()}`;
  }

  private extractMessageAndErrors(
    exception: unknown,
    status: number,
  ): { message: string; errors: Record<string, string[]> | null } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();

      // ValidationPipe (class-validator) throws BadRequestException with:
      // { message: string[], error: 'Bad Request', statusCode: 400 }
      // or { message: string, errors: {...} } depending on caller.
      if (typeof res === "object" && res !== null) {
        const obj = res as any;

        // Preferred: already canonical — pass through errors if present
        if ("errors" in obj && typeof obj.errors === "object") {
          return {
            message:
              typeof obj.message === "string"
                ? obj.message
                : "Validation failed",
            errors: obj.errors as Record<string, string[]>,
          };
        }

        // class-validator default: { statusCode, message: string[], error }
        if (Array.isArray(obj.message)) {
          // Map array of constraint strings like "sku must be ..." to errors under _global or field inference.
          // Better: expose as errors._global so frontend can display.
          // If messages are already field-scoped, preserve them.
          const errors = this.mapArrayMessagesToErrors(obj.message);
          return {
            message: "Validation failed",
            errors,
          };
        }

        // Single string message
        if (typeof obj.message === "string") {
          // For 400, try to populate errors if details available
          if (status === 400 && obj.errors) {
            return { message: obj.message, errors: obj.errors };
          }
          // For 400 without structured errors, put message under _global
          // Preserve original message so callers can match on "Idempotency-Key" etc.
          if (status === 400) {
            return {
              message: obj.message,
              errors: { _global: [obj.message] },
            };
          }
          return { message: obj.message, errors: null };
        }

        // Handle `code` + `message` style from service (e.g., INSUFFICIENT_INVENTORY)
        if (typeof obj.message === "string" || Array.isArray(obj.message)) {
          const msg = Array.isArray(obj.message)
            ? obj.message.join("; ")
            : obj.message;
          // Preserve code in message but don't leak details; errors stays null for non-400.
          return {
            message: msg,
            errors: status === 400 ? { _global: [msg] } : null,
          };
        }
      }

      if (typeof res === "string") {
        return {
          message: res,
          errors: status === 400 ? { _global: [res] } : null,
        };
      }

      return {
        message: (exception as HttpException).message,
        errors:
          status === 400
            ? { _global: [(exception as HttpException).message] }
            : null,
      };
    }

    // Non-HttpException → 500 with generic message (no internal details).
    return { message: "An unexpected error occurred", errors: null };
  }

  private mapArrayMessagesToErrors(
    messages: string[],
  ): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    for (const msg of messages) {
      // Try to infer field from message prefix like "sku must ..." or "quantity must ..."
      const fieldMatch = msg.match(/^([a-zA-Z0-9_]+)\s/);
      const field = fieldMatch ? fieldMatch[1] : "_global";
      if (!errors[field]) errors[field] = [];
      errors[field].push(msg);
    }
    return errors;
  }
}
