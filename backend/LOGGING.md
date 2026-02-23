# Logging System Documentation

This application uses Winston for production-ready logging with environment-based configuration.

## Features

- **Structured Logging**: JSON-formatted logs for easy parsing and analysis
- **Environment-based Configuration**: Different log levels and transports for development, production, and test environments
- **Request/Response Logging**: Automatic logging of all HTTP requests with timing information
- **Error Logging**: Comprehensive error tracking with stack traces and context
- **Sensitive Data Protection**: Automatic redaction of sensitive fields (passwords, tokens, etc.)
- **Log Rotation**: Daily log rotation with automatic compression and retention policies (production only)

## Log Levels

The application supports the following log levels (in order of priority):

1. `error` - Error conditions
2. `warn` - Warning conditions
3. `info` - Informational messages
4. `http` - HTTP request/response logs
5. `verbose` - Verbose informational messages
6. `debug` - Debug-level messages
7. `silly` - Very detailed debug messages

## Environment Configuration

### Environment Variables

Configure logging behavior using these environment variables:

```bash
# Log level (default: 'debug' for dev, 'info' for production)
LOG_LEVEL=info

# Enable console logging in production (default: false)
LOG_CONSOLE=true

# Application environment (affects default log level and transports)
NODE_ENV=production
```

### Environment-specific Defaults

**Development:**

- Log Level: `debug`
- Transports: Console (colored, human-readable format)
- File Logging: Disabled

**Production:**

- Log Level: `info`
- Transports: File (JSON format)
- Console Logging: Disabled (unless `LOG_CONSOLE=true`)
- Log Files:
  - `logs/error-YYYY-MM-DD.log` - Error logs only
  - `logs/combined-YYYY-MM-DD.log` - All logs
  - `logs/http-YYYY-MM-DD.log` - HTTP request/response logs
- Log Rotation: Daily, 20MB max size per file
- Retention: 14 days for combined/error logs, 7 days for HTTP logs

**Test:**

- Log Level: `error`
- Transports: Console
- File Logging: Disabled

## Usage in Code

### Injecting the Logger

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from './common/logger/logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: LoggerService) {}

  someMethod() {
    this.logger.log('This is an info message', 'MyService');
    this.logger.error('This is an error', stack, 'MyService');
    this.logger.warn('This is a warning', 'MyService');
    this.logger.debug('This is a debug message', 'MyService');
  }
}
```

### Log Methods

```typescript
// Basic logging
logger.log(message: string, context?: string);
logger.error(message: string, trace?: string, context?: string);
logger.warn(message: string, context?: string);
logger.debug(message: string, context?: string);
logger.verbose(message: string, context?: string);

// HTTP logging (used by middleware)
logger.http(message: string, meta?: Record<string, any>);

// Custom metadata logging
logger.logWithMeta(level: string, message: string, meta: Record<string, any>);
```

## Sensitive Data Protection

The logger automatically redacts the following fields:

- `password`
- `token`
- `accessToken`
- `refreshToken`
- `authorization`
- `secret`
- `apiKey`
- `creditCard`
- `ssn`

These fields will be replaced with `[REDACTED]` in logs.

## Log File Structure (Production)

```
backend/
└── logs/
    ├── error-2024-01-27.log
    ├── error-2024-01-28.log
    ├── combined-2024-01-27.log
    ├── combined-2024-01-28.log
    ├── http-2024-01-27.log
    └── http-2024-01-28.log
```

## HTTP Request Logging

All HTTP requests are automatically logged with the following information:

```json
{
  "level": "http",
  "message": "GET /api/v1/users 200 - 45ms",
  "timestamp": "2024-01-27 10:30:45",
  "method": "GET",
  "url": "/api/v1/users",
  "statusCode": 200,
  "responseTime": 45,
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

## Error Logging

Errors are logged with comprehensive context:

```json
{
  "level": "error",
  "message": "POST /api/v1/users - 500 - Internal server error",
  "timestamp": "2024-01-27 10:30:45",
  "context": "HttpExceptionFilter",
  "statusCode": 500,
  "method": "POST",
  "url": "/api/v1/users",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "errorMessage": "Database connection failed",
  "stack": "Error: Database connection failed\n    at..."
}
```

## Best Practices

1. **Use Appropriate Log Levels**:
   - `error` for errors that need immediate attention
   - `warn` for potentially harmful situations
   - `info` for important business logic events
   - `debug` for diagnostic information

2. **Include Context**: Always provide context (usually the class name) when logging

3. **Avoid Logging Sensitive Data**: Never manually log passwords, tokens, or personal information

4. **Use Structured Logging**: Pass metadata objects instead of concatenating strings

5. **Don't Over-log**: Avoid logging in tight loops or high-frequency operations

## Monitoring and Analysis

In production, you can:

1. **View Recent Logs**:

   ```bash
   tail -f logs/combined-$(date +%Y-%m-%d).log
   ```

2. **View Error Logs Only**:

   ```bash
   tail -f logs/error-$(date +%Y-%m-%d).log
   ```

3. **Search Logs**:

   ```bash
   grep "search term" logs/combined-*.log
   ```

4. **Parse JSON Logs**:
   ```bash
   cat logs/combined-2024-01-27.log | jq '.level'
   ```

## Integration with External Services

The Winston logger can be easily extended to send logs to external services like:

- **Elasticsearch** (via winston-elasticsearch)
- **CloudWatch** (via winston-cloudwatch)
- **Datadog** (via winston-datadog)
- **Sentry** (for error tracking)

To add these, install the appropriate Winston transport and add it to the transports array in [logger.config.ts](src/common/logger/logger.config.ts).
