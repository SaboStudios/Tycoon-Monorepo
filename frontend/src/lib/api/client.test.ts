import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TycoonApiError, parseErrorResponse } from './errors';
import { apiClient } from './client';

describe('API Error Mapping — parseErrorResponse (#799)', () => {
  describe('HTTP status mapping', () => {
    const testCases: Array<[number, string]> = [
      [400, 'VALIDATION_ERROR'],
      [401, 'UNAUTHORIZED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
      [429, 'RATE_LIMIT'],
      [500, 'INTERNAL_SERVER_ERROR'],
    ];

    testCases.forEach(([status, expectedCode]) => {
      it(`maps HTTP ${status} to ${expectedCode}`, async () => {
        const response = new Response(JSON.stringify({ message: 'Test error' }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });

        const error = await parseErrorResponse(response);
        expect(error).toBeInstanceOf(TycoonApiError);
        expect(error.code).toBe(expectedCode);
        expect(error.statusCode).toBe(status);
      });
    });

    it('maps unknown status to UNKNOWN error code', async () => {
      const response = new Response(JSON.stringify({ message: 'Test error' }), {
        status: 418,
        headers: { 'Content-Type': 'application/json' },
      });

      const error = await parseErrorResponse(response);
      expect(error.code).toBe('UNKNOWN');
      expect(error.statusCode).toBe(418);
    });
  });

  describe('JSON response parsing', () => {
    it('extracts message from JSON response', async () => {
      const response = new Response(JSON.stringify({ message: 'Invalid email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      const error = await parseErrorResponse(response);
      expect(error.message).toBe('Invalid email');
    });

    it('falls back to statusText when message is missing', async () => {
      const response = new Response(JSON.stringify({}), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      });

      const error = await parseErrorResponse(response);
      expect(error.message).toBe('Internal Server Error');
    });

    it('extracts field-level errors from details field', async () => {
      const response = new Response(
        JSON.stringify({
          message: 'Validation failed',
          errors: {
            email: ['email must be a valid email address'],
            password: ['password should not be empty'],
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const error = await parseErrorResponse(response);
      expect(error.details).toEqual({
        email: ['email must be a valid email address'],
        password: ['password should not be empty'],
      });
    });
  });

  describe('malformed responses', () => {
    it('handles non-JSON response body gracefully', async () => {
      const response = new Response('<html>error</html>', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/html' },
      });

      const error = await parseErrorResponse(response);
      expect(error).toBeInstanceOf(TycoonApiError);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal Server Error');
    });

    it('handles empty response body gracefully', async () => {
      const response = new Response('', {
        status: 502,
        statusText: 'Bad Gateway',
      });

      const error = await parseErrorResponse(response);
      expect(error).toBeInstanceOf(TycoonApiError);
      expect(error.statusCode).toBe(502);
      expect(error.message).toBe('Bad Gateway');
    });

    it('handles JSON parse errors gracefully', async () => {
      const response = new Response('{"invalid json"', {
        status: 400,
        statusText: 'Bad Request',
      });

      const error = await parseErrorResponse(response);
      expect(error).toBeInstanceOf(TycoonApiError);
      expect(error.message).toBe('Bad Request');
    });
  });

  describe('network and timeout errors', () => {
    it('creates TIMEOUT error for AbortError', async () => {
      const error = new TycoonApiError({
        code: 'TIMEOUT',
        statusCode: 408,
        message: 'Request timed out after 10000ms',
      });

      expect(error.code).toBe('TIMEOUT');
      expect(error.statusCode).toBe(408);
      expect(error.message).toContain('timed out');
    });

    it('creates NETWORK_ERROR for fetch failures', () => {
      const error = new TycoonApiError({
        code: 'NETWORK_ERROR',
        statusCode: 0,
        message: 'Failed to fetch',
      });

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBe(0);
    });
  });
});

describe('API Client Retry Logic (#799)', () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('retries on 429 (rate limit)', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Too many requests' }), {
          status: 429,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

    const result = await apiClient.get<{ success: boolean }>('/test', { retries: 1 });
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 (service unavailable)', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Service unavailable' }), {
          status: 503,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

    const result = await apiClient.get<{ success: boolean }>('/test', { retries: 1 });
    expect(result.success).toBe(true);
  });

  it('fails immediately on non-retryable status (401)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
      })
    );

    try {
      await apiClient.get('/test');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TycoonApiError);
      expect((err as TycoonApiError).code).toBe('UNAUTHORIZED');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    }
  });

  it('respects max retries limit', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Service unavailable' }), {
        status: 503,
      })
    );

    try {
      await apiClient.get('/test', { retries: 1 });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TycoonApiError);
      expect((err as TycoonApiError).code).toBe('INTERNAL_SERVER_ERROR');
      // 1 initial + 1 retry = 2 calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }
  });
});

describe('Type Guards (#799)', () => {
  const { isApiError, isValidationError, isUnauthorized } = await import('./errors');

  it('isApiError identifies TycoonApiError instances', () => {
    const error = new TycoonApiError({
      code: 'NETWORK_ERROR',
      statusCode: 0,
      message: 'Network failed',
    });

    expect(isApiError(error)).toBe(true);
    expect(isApiError(new Error('Not an API error'))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });

  it('isValidationError identifies VALIDATION_ERROR code', () => {
    const validationError = new TycoonApiError({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Invalid input',
      details: { email: ['invalid'] },
    });

    const otherError = new TycoonApiError({
      code: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'Not authorized',
    });

    expect(isValidationError(validationError)).toBe(true);
    expect(isValidationError(otherError)).toBe(false);
  });

  it('isUnauthorized identifies auth-related errors', () => {
    const unauthorizedError = new TycoonApiError({
      code: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'Unauthorized',
    });

    const forbiddenError = new TycoonApiError({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'Forbidden',
    });

    const validationError = new TycoonApiError({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Invalid input',
    });

    expect(isUnauthorized(unauthorizedError)).toBe(true);
    expect(isUnauthorized(forbiddenError)).toBe(false);
    expect(isUnauthorized(validationError)).toBe(false);
  });
});
