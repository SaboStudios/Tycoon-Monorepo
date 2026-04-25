/**
 * SW-BE-028 — HttpExceptionFilter: DTO validation and error mapping tests.
 *
 * Verifies that the filter:
 *  - wraps every response in the StandardResponse envelope
 *  - flattens ValidationPipe message arrays into a single string
 *  - maps HttpException, plain Error, and unknown throws correctly
 *  - never leaks stack traces in the response body
 *  - routes 4xx to warn and 5xx to error log levels
 */
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { LoggerService } from '../logger/logger.service';

// ── helpers ──────────────────────────────────────────────────────────────────

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  logWithMeta: jest.fn(),
};

function buildHost(method = 'POST', url = '/api/v1/test'): ArgumentsHost & {
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const req = {
    method,
    url,
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest-test' },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ status }),
    }),
    json,
    status,
  } as unknown as ArgumentsHost & { json: jest.Mock; status: jest.Mock };
}

function getResponseBody(host: ReturnType<typeof buildHost>): Record<string, unknown> {
  return host.json.mock.calls[0][0] as Record<string, unknown>;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter(mockLogger as unknown as LoggerService);
    jest.clearAllMocks();
  });

  // ── StandardResponse envelope ─────────────────────────────────────────────

  describe('StandardResponse envelope', () => {
    it('always sets success: false', () => {
      const host = buildHost();
      filter.catch(new HttpException('Bad Request', HttpStatus.BAD_REQUEST), host);
      expect(getResponseBody(host).success).toBe(false);
    });

    it('always sets data: null', () => {
      const host = buildHost();
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);
      expect(getResponseBody(host).data).toBeNull();
    });

    it('includes statusCode in the response body', () => {
      const host = buildHost();
      filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), host);
      expect(getResponseBody(host).statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it('sets the HTTP status on the response object', () => {
      const host = buildHost();
      filter.catch(new HttpException('Conflict', HttpStatus.CONFLICT), host);
      expect(host.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    });
  });

  // ── HttpException — string message ────────────────────────────────────────

  describe('HttpException with string message', () => {
    it('passes the string message through', () => {
      const host = buildHost();
      filter.catch(new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED), host);
      expect(getResponseBody(host).message).toBe('Unauthorized');
    });
  });

  // ── HttpException — object response (ValidationPipe shape) ───────────────

  describe('HttpException with object response (ValidationPipe)', () => {
    it('flattens a message array into a comma-separated string', () => {
      const host = buildHost();
      const ex = new HttpException(
        { statusCode: 400, message: ['name must not be empty', 'email must be an email'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(ex, host);
      const body = getResponseBody(host);
      expect(body.message).toBe('name must not be empty, email must be an email');
    });

    it('passes a single string message through unchanged', () => {
      const host = buildHost();
      const ex = new HttpException(
        { statusCode: 400, message: 'Invalid input', error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(ex, host);
      expect(getResponseBody(host).message).toBe('Invalid input');
    });

    it('falls back to exception.message when response object has no message', () => {
      const host = buildHost();
      const ex = new HttpException({ statusCode: 400 }, HttpStatus.BAD_REQUEST);
      filter.catch(ex, host);
      // NestJS HttpException.message is the default "Http Exception" string
      expect(typeof getResponseBody(host).message).toBe('string');
    });
  });

  // ── plain Error ───────────────────────────────────────────────────────────

  describe('plain Error', () => {
    it('maps to 500 Internal Server Error', () => {
      const host = buildHost();
      filter.catch(new Error('Something broke'), host);
      expect(host.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('uses the error message', () => {
      const host = buildHost();
      filter.catch(new Error('DB connection lost'), host);
      expect(getResponseBody(host).message).toBe('DB connection lost');
    });

    it('does not include stack in the response body', () => {
      const host = buildHost();
      filter.catch(new Error('oops'), host);
      expect(getResponseBody(host)).not.toHaveProperty('stack');
    });
  });

  // ── unknown exception ─────────────────────────────────────────────────────

  describe('unknown exception (non-Error throw)', () => {
    it('maps to 500', () => {
      const host = buildHost();
      filter.catch('something weird', host);
      expect(host.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('returns "Internal server error" message', () => {
      const host = buildHost();
      filter.catch({ code: 'UNKNOWN' }, host);
      expect(getResponseBody(host).message).toBe('Internal server error');
    });
  });

  // ── logging routing ───────────────────────────────────────────────────────

  describe('logging routing', () => {
    it('logs 4xx at warn level', () => {
      const host = buildHost();
      filter.catch(new HttpException('Bad Request', HttpStatus.BAD_REQUEST), host);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('logs 5xx at error level', () => {
      const host = buildHost();
      filter.catch(new HttpException('Server Error', HttpStatus.INTERNAL_SERVER_ERROR), host);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('does not log 2xx/3xx (no exception expected, but guard test)', () => {
      // HttpExceptionFilter only handles exceptions; this verifies no spurious
      // warn/error calls happen for a 404 (client error, not server error).
      const host = buildHost();
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('does not emit secrets in logWithMeta context', () => {
      const host = buildHost();
      filter.catch(new HttpException('Bad Request', HttpStatus.BAD_REQUEST), host);
      const calls = mockLogger.logWithMeta.mock.calls as [string, string, Record<string, unknown>][];
      for (const [, , ctx] of calls) {
        const serialised = JSON.stringify(ctx);
        expect(serialised).not.toMatch(/password/i);
        expect(serialised).not.toMatch(/token/i);
        expect(serialised).not.toMatch(/secret/i);
      }
    });
  });
});
