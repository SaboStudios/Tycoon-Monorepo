import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Request } from "express";
import { AppLogger } from "../../logger/app-logger.service";

/** TypeORM / Postgres error codes mapped to HTTP 4xx */
const TYPEORM_CODE_MAP: Record<string, { status: number; message: string }> = {
  "23505": { status: HttpStatus.CONFLICT, message: "Resource already exists" },
  "23503": { status: HttpStatus.UNPROCESSABLE_ENTITY, message: "Referenced resource does not exist" },
  "23502": { status: HttpStatus.BAD_REQUEST, message: "Required field is missing" },
  "23514": { status: HttpStatus.BAD_REQUEST, message: "Value violates a check constraint" },
};

/** Keys whose values must never appear in error payloads */
const SECRET_KEYS = new Set([
  "password", "newpassword", "token", "authorization",
  "refreshtoken", "secret", "apikey", "api_key",
]);

function sanitize(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitize(v, depth + 1));
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : sanitize(v, depth + 1),
      ]),
    );
  }
  return obj;
}

export interface ErrorPayload {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
  timestamp: string;
  path: string;
}

const isProd = () => process.env.NODE_ENV === "production";

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: AppLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "Internal server error";
    let details: unknown;
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = this.codeFromStatus(status);
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? exception.message;
        // validation errors produce an array — keep as details
        if (Array.isArray(b.message)) {
          message = "Validation failed";
          details = sanitize(b.message);
        }
        if (b.error && typeof b.error === "string") code = b.error.toUpperCase().replace(/\s+/g, "_");
      }
      stack = exception.stack;
    } else if (exception instanceof Error) {
      const dbErr = exception as unknown as Record<string, unknown>;
      const mapped = dbErr.code ? TYPEORM_CODE_MAP[dbErr.code as string] : undefined;
      if (mapped) {
        status = mapped.status;
        message = mapped.message;
        code = this.codeFromStatus(status);
      } else {
        message = "Internal server error";
      }
      stack = exception.stack;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack, "HttpExceptionFilter");
    } else {
      this.logger.error("Unknown exception", String(exception), "HttpExceptionFilter");
    }

    const payload: ErrorPayload = sanitize({
      statusCode: status,
      code,
      message,
      ...(details !== undefined && { details }),
      ...(!isProd() && stack ? { stack } : {}),
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    }) as ErrorPayload;

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status}`, stack, "HttpExceptionFilter");
    } else {
      this.logger.warn(`${req.method} ${req.url} → ${status}: ${message}`, "HttpExceptionFilter");
    }

    httpAdapter.reply(ctx.getResponse(), payload, status);
  }

  private codeFromStatus(status: number): string {
    return (
      Object.entries(HttpStatus).find(([, v]) => v === status)?.[0] ??
      "HTTP_ERROR"
    );
  }
}
