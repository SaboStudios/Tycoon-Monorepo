import { describe, it, expect } from 'vitest';
import {
  TycoonApiError,
  isApiError,
  isValidationError,
  isUnauthorized,
  parseErrorResponse,
} from '../../src/lib/api/errors';

// ─── TycoonApiError ───────────────────────────────────────────────────────────

describe('TycoonApiError', () => {
  it('sets all fields from constructor argument', () => {
    const err = new TycoonApiError({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'Resource not found',
      details: { field: ['required'] },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TycoonApiError);
    expect(err.name).toBe('TycoonApiError');
    expect(err.message).toBe('Resource not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.details).toEqual({ field: ['required'] });
  });

  it('details is undefined when not provided', () => {
    const err = new TycoonApiError({ code: 'UNKNOWN', statusCode: 0, message: 'oops' });
    expect(err.details).toBeUndefined();
  });
});

// ─── Type guards ──────────────────────────────────────────────────────────────

describe('isApiError', () => {
  it('returns true for TycoonApiError instances', () => {
    expect(isApiError(new TycoonApiError({ code: 'FORBIDDEN', statusCode: 403, message: 'x' }))).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isApiError(new Error('plain'))).toBe(false);
  });

  it('returns false for null / primitives', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError('string')).toBe(false);
    expect(isApiError(42)).toBe(false);
  });
});

describe('isValidationError', () => {
  it('returns true when code is VALIDATION_ERROR', () => {
    const err = new TycoonApiError({ code: 'VALIDATION_ERROR', statusCode: 400, message: 'bad' });
    expect(isValidationError(err)).toBe(true);
  });

  it('returns false for other error codes', () => {
    const err = new TycoonApiError({ code: 'NOT_FOUND', statusCode: 404, message: 'x' });
    expect(isValidationError(err)).toBe(false);
  });

  it('returns false for non-TycoonApiError', () => {
    expect(isValidationError(new Error('x'))).toBe(false);
  });
});

describe('isUnauthorized', () => {
  it('returns true when code is UNAUTHORIZED', () => {
    const err = new TycoonApiError({ code: 'UNAUTHORIZED', statusCode: 401, message: 'x' });
    expect(isUnauthorized(err)).toBe(true);
  });

  it('returns false for other codes', () => {
    const err = new TycoonApiError({ code: 'FORBIDDEN', statusCode: 403, message: 'x' });
    expect(isUnauthorized(err)).toBe(false);
  });
});

// ─── parseErrorResponse ───────────────────────────────────────────────────────

function makeResponse(status: number, body?: object | null, statusText = ''): Response {
  const isJson = body !== null;
  const bodyStr = isJson ? JSON.stringify(body ?? {}) : 'not-json';
  return new Response(bodyStr, {
    status,
    statusText,
    headers: { 'Content-Type': isJson ? 'application/json' : 'text/plain' },
  });
}

describe('parseErrorResponse', () => {
  const statusCodeMap: Array<[number, string]> = [
    [400, 'VALIDATION_ERROR'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [500, 'INTERNAL_SERVER_ERROR'],
    [503, 'UNKNOWN'],
  ];

  it.each(statusCodeMap)('maps HTTP %i → code %s', async (status, expectedCode) => {
    const err = await parseErrorResponse(makeResponse(status, { message: 'msg' }));
    expect(err.code).toBe(expectedCode);
    expect(err.statusCode).toBe(status);
  });

  it('uses body.message when present', async () => {
    const err = await parseErrorResponse(makeResponse(404, { message: 'custom msg' }));
    expect(err.message).toBe('custom msg');
  });

  it('falls back to statusText when body has no message', async () => {
    const res = new Response('{}', { status: 404, statusText: 'Not Found' });
    const err = await parseErrorResponse(res);
    expect(err.message).toBe('Not Found');
  });

  it('populates details from body.errors', async () => {
    const errors = { email: ['must be valid'] };
    const err = await parseErrorResponse(makeResponse(400, { message: 'bad', errors }));
    expect(err.details).toEqual(errors);
  });

  it('handles non-JSON body gracefully without throwing', async () => {
    const res = new Response('not-json', { status: 500, statusText: 'Server Error' });
    const err = await parseErrorResponse(res);
    expect(err.code).toBe('INTERNAL_SERVER_ERROR');
    expect(err.message).toBe('Server Error');
  });
});
