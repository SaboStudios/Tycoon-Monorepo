/**
 * SW-BE-028 — AllExceptionsFilter: DTO validation and error mapping tests.
 */
import { AllExceptionsFilter } from './all-exceptions.filter';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';

// ── helpers ──────────────────────────────────────────────────────────────────

const mockHttpAdapterHost: {
  httpAdapter: {
    getRequestUrl: jest.Mock;
    reply: jest.Mock;
  };
} = {
  httpAdapter: {
    getRequestUrl: jest.fn(),
    reply: jest.fn(),
  },
};

const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  logWithMeta: jest.fn(),
};

const createMockHost = (
  overrides: { method?: string; url?: string } = {},
): ArgumentsHost => {
  const req = {
    method: overrides.method ?? 'GET',
    url: overrides.url ?? '/test-url',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  };
  return {
    switchToHttp: () => ({
      getResponse: jest.fn(),
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
};

function getReplyBody(calls: unknown[][]): Record<string, unknown> {
  return calls[0][1] as Record<string, unknown>;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllExceptionsFilter,
        { provide: HttpAdapterHost, useValue: mockHttpAdapterHost },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);
    jest.clearAllMocks();
    mockHttpAdapterHost.httpAdapter.getRequestUrl.mockReturnValue('/test-url');
  });

  // ── HttpException — string message ────────────────────────────────────────

  describe('HttpException with string message', () => {
    it('returns the string message and correct status', () => {
      const host = createMockHost();
      filter.catch(new HttpException('Bad Request', HttpStatus.BAD_REQUEST), host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('Bad Request');
    });
  });

  // ── HttpException — ValidationPipe array message ──────────────────────────

  describe('HttpException with ValidationPipe message array', () => {
    it('joins the array with "; " separator', () => {
      const host = createMockHost();
      const ex = new HttpException(
        {
          statusCode: 400,
          message: ['name must not be empty', 'email must be an email'],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(ex, host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.message).toBe('name must not be empty; email must be an email');
    });

    it('includes the error field when present', () => {
      const host = createMockHost();
      const ex = new HttpException(
        { statusCode: 400, message: ['field required'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(ex, host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.error).toBe('Bad Request');
    });

    it('handles a single-element message array', () => {
      const host = createMockHost();
      const ex = new HttpException(
        { statusCode: 400, message: ['limit must be a positive number'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(ex, host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.message).toBe('limit must be a positive number');
    });
  });

  // ── HttpException — object message (no array) ─────────────────────────────

  describe('HttpException with object response (string message)', () => {
    it('passes a string message through unchanged', () => {
      const host = createMockHost();
      const ex = new HttpException(
        { statusCode: 409, message: 'Duplicate entry', error: 'Conflict' },
        HttpStatus.CONFLICT,
      );
      filter.catch(ex, host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.message).toBe('Duplicate entry');
      expect(body.statusCode).toBe(409);
    });
  });

  // ── plain Error ───────────────────────────────────────────────────────────

  describe('plain Error', () => {
    it('returns 500 and the error message', () => {
      const host = createMockHost();
      filter.catch(new Error('Random error'), host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.statusCode).toBe(500);
      expect(body.message).toBe('Random error');
    });

    it('does not include stack in the response body', () => {
      const host = createMockHost();
      filter.catch(new Error('oops'), host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body).not.toHaveProperty('stack');
    });
  });

  // ── Postgres error codes ──────────────────────────────────────────────────

  describe('Postgres error code mapping', () => {
    it('maps 23505 (duplicate key) to 409 Conflict', () => {
      const host = createMockHost();
      filter.catch(Object.assign(new Error('duplicate key'), { code: '23505' }), host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.statusCode).toBe(HttpStatus.CONFLICT);
      expect(body.message).toBe('Duplicate entry');
    });

    it('maps 23503 (foreign key violation) to 400 Bad Request', () => {
      const host = createMockHost();
      filter.catch(Object.assign(new Error('foreign key'), { code: '23503' }), host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toBe('Referenced record does not exist');
    });

    it('maps 23502 (not null violation) to 400 Bad Request', () => {
      const host = createMockHost();
      filter.catch(Object.assign(new Error('not null'), { code: '23502' }), host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toBe('Required field is missing');
    });

    it('returns 500 for an unrecognised DB error code', () => {
      const host = createMockHost();
      filter.catch(Object.assign(new Error('unknown db error'), { code: '99999' }), host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.statusCode).toBe(500);
    });
  });

  // ── unknown exception ─────────────────────────────────────────────────────

  describe('unknown exception (non-Error throw)', () => {
    it('returns 500 for a plain object throw', () => {
      const host = createMockHost();
      filter.catch({ weird: true }, host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.statusCode).toBe(500);
    });

    it('returns 500 for a string throw', () => {
      const host = createMockHost();
      filter.catch('something went wrong', host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body.statusCode).toBe(500);
    });
  });

  // ── response shape ────────────────────────────────────────────────────────

  describe('response shape', () => {
    it('always includes statusCode, timestamp, path, and message', () => {
      const host = createMockHost();
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body).toHaveProperty('statusCode');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('path');
      expect(body).toHaveProperty('message');
    });

    it('does not include stack in the response body', () => {
      const host = createMockHost();
      filter.catch(new HttpException('Error', HttpStatus.INTERNAL_SERVER_ERROR), host);
      const body = getReplyBody(mockHttpAdapterHost.httpAdapter.reply.mock.calls as unknown[][]);
      expect(body).not.toHaveProperty('stack');
    });
  });

  // ── logging routing ───────────────────────────────────────────────────────

  describe('logging routing', () => {
    it('calls logWithMeta at error level for 5xx', () => {
      const host = createMockHost();
      filter.catch(new Error('server crash'), host);
      expect(mockLoggerService.logWithMeta).toHaveBeenCalledWith(
        'error',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('calls logWithMeta at warn level for 4xx', () => {
      const host = createMockHost();
      filter.catch(new HttpException('Bad Request', HttpStatus.BAD_REQUEST), host);
      expect(mockLoggerService.logWithMeta).toHaveBeenCalledWith(
        'warn',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('does not emit secrets in logWithMeta context', () => {
      const host = createMockHost();
      filter.catch(new HttpException('Bad Request', HttpStatus.BAD_REQUEST), host);
      const calls = mockLoggerService.logWithMeta.mock.calls as [string, string, Record<string, unknown>][];
      for (const [, , ctx] of calls) {
        const serialised = JSON.stringify(ctx);
        expect(serialised).not.toMatch(/password/i);
        expect(serialised).not.toMatch(/token/i);
        expect(serialised).not.toMatch(/secret/i);
      }
    });
  });
});
