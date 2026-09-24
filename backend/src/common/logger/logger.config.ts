import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Winston logger configuration factory
 * Creates different transports based on environment
 */
export const createWinstonConfig = (environment: string = 'development') => {
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';

  // Custom format to exclude sensitive data
  const sanitizeFormat = winston.format((info) => {
    // Remove sensitive fields from logs
    const sensitiveFields = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
    ];

    if (info.context && typeof info.context === 'object') {
      const ctx = info.context as Record<string, unknown>;
      sensitiveFields.forEach((field) => {
        if (field in ctx) {
          ctx[field] = '[REDACTED]';
        }
      });
    }

    if (info.message && typeof info.message === 'object') {
      const msg = info.message as Record<string, unknown>;
      sensitiveFields.forEach((field) => {
        if (field in msg) {
          msg[field] = '[REDACTED]';
        }
      });
    }

    return info;
  });

  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    sanitizeFormat(),
    winston.format.splat(),
    winston.format.json(),
  );

  // Console format for development (more readable)
  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    sanitizeFormat(),
    winston.format.ms(),
    nestWinstonModuleUtilities.format.nestLike('TycoonAPI', {
      colors: true,
      prettyPrint: true,
    }),
  );

  // Transports configuration
  const transports: winston.transport[] = [];

  // Console transport (always enabled in development, optional in production)
  if (isDevelopment || process.env.LOG_CONSOLE === 'true') {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
        level: process.env.LOG_LEVEL || 'debug',
      }),
    );
  }

  // File transports for production
  if (isProduction) {
    // Error logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: logFormat,
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
      }),
    );

    // Combined logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        format: logFormat,
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
        level: process.env.LOG_LEVEL || 'info',
      }),
    );

    // HTTP request logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/http-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        format: logFormat,
        maxSize: '20m',
        maxFiles: '7d',
        zippedArchive: true,
        level: 'http',
      }),
    );
  }

  return {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    format: logFormat,
    transports,
    exitOnError: false,
    // Custom levels including HTTP
    levels: {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6,
    },
  };
};

/**
 * Log level mapping for different environments
 */
export const getLogLevel = (environment: string = 'development'): string => {
  const envLogLevel = process.env.LOG_LEVEL;
  if (envLogLevel) {
    return envLogLevel;
  }

  switch (environment) {
    case 'production':
      return 'info';
    case 'test':
      return 'error';
    case 'development':
    default:
      return 'debug';
  }
};
