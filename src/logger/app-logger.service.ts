import { Injectable, LoggerService } from "@nestjs/common";
import * as winston from "winston";
import { getRequestId } from "./correlation.context";

/**
 * PII scrubbing rules:
 *  - "password", "newPassword", "token", "authorization" keys are redacted.
 *  - Email addresses in string values are masked (user@domain → u***@domain).
 *  - These rules apply to all structured log metadata before serialisation.
 */

const PII_KEYS = new Set([
  "password",
  "newpassword",
  "token",
  "authorization",
  "refreshtoken",
]);

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.replace(EMAIL_RE, (m) => m[0] + "***@" + m.split("@")[1]);
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        PII_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : scrub(v, depth + 1),
      ]),
    );
  }
  return value;
}

const isProduction = process.env.NODE_ENV === "production";

const transports: winston.transport[] = [
  isProduction
    ? new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      })
    : new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: "HH:mm:ss" }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const rid = meta.requestId ? ` [${meta.requestId}]` : "";
            const rest = Object.keys(meta).length
              ? " " + JSON.stringify(meta)
              : "";
            return `${timestamp} ${level}${rid}: ${message}${rest}`;
          }),
        ),
      }),
];

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  transports,
});

/** Exported for testing only */
export const scrubForTest = scrub;

@Injectable()
export class AppLogger implements LoggerService {
  private write(
    level: string,
    message: unknown,
    context?: string,
    meta?: Record<string, unknown>,
  ): void {
    const requestId = getRequestId();
    const entry = scrub({
      message,
      context,
      requestId,
      ...meta,
    }) as Record<string, unknown>;
    winstonLogger.log(level, entry.message as string, entry);
  }

  log(message: unknown, context?: string): void {
    this.write("info", message, context);
  }
  error(message: unknown, trace?: string, context?: string): void {
    this.write("error", message, context, { trace });
  }
  warn(message: unknown, context?: string): void {
    this.write("warn", message, context);
  }
  debug(message: unknown, context?: string): void {
    this.write("debug", message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.write("verbose", message, context);
  }
}
