import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import TycoonApiError directly from its source to avoid barrel mock interference
import { TycoonApiError } from '@/lib/api/errors';
import type { ApiErrorCode } from '@/lib/api/errors';
import {
  API_ERROR_TOAST_MESSAGES,
  getApiErrorMessage,
  toastApiError,
} from '.';

// ---------------------------------------------------------------------------
// Mock toastManager so we never touch react-toastify in unit tests.
// Use vi.hoisted so the mock object is available when vi.mock factory runs.
// ---------------------------------------------------------------------------

const { mockToastManager } = vi.hoisted(() => ({
  mockToastManager: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    show: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('./toast-manager', () => ({
  toastManager: mockToastManager,
}));

const mockError = mockToastManager.error;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// API_ERROR_TOAST_MESSAGES — completeness
// ---------------------------------------------------------------------------

describe('API_ERROR_TOAST_MESSAGES', () => {
  const ALL_CODES: ApiErrorCode[] = [
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'VALIDATION_ERROR',
    'CONFLICT',
    'RATE_LIMIT',
    'INTERNAL_SERVER_ERROR',
    'NETWORK_ERROR',
    'TIMEOUT',
    'UNKNOWN',
  ];

  it('has a non-empty message for every ApiErrorCode', () => {
    for (const code of ALL_CODES) {
      expect(typeof API_ERROR_TOAST_MESSAGES[code]).toBe('string');
      expect(API_ERROR_TOAST_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it('does not expose internal details in any message', () => {
    const forbidden = ['stack', 'trace', 'sql', 'token', 'secret', 'password'];
    for (const message of Object.values(API_ERROR_TOAST_MESSAGES)) {
      for (const word of forbidden) {
        expect(message.toLowerCase()).not.toContain(word);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getApiErrorMessage
// ---------------------------------------------------------------------------

describe('getApiErrorMessage', () => {
  it('returns the mapped message for a known code', () => {
    expect(getApiErrorMessage('UNAUTHORIZED')).toBe(
      API_ERROR_TOAST_MESSAGES.UNAUTHORIZED,
    );
    expect(getApiErrorMessage('NETWORK_ERROR')).toBe(
      API_ERROR_TOAST_MESSAGES.NETWORK_ERROR,
    );
  });

  it('returns the UNKNOWN fallback for an unrecognised code', () => {
    // Cast to bypass TS — simulates a future code not yet in the union
    expect(getApiErrorMessage('FUTURE_CODE' as ApiErrorCode)).toBe(
      API_ERROR_TOAST_MESSAGES.UNKNOWN,
    );
  });
});

// ---------------------------------------------------------------------------
// toastApiError — routing
// ---------------------------------------------------------------------------

describe('toastApiError', () => {
  it('calls toastManager.error with the mapped message for a TycoonApiError', () => {
    const err = new TycoonApiError({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'raw server message',
    });

    toastApiError(err);

    expect(mockError).toHaveBeenCalledOnce();
    expect(mockError).toHaveBeenCalledWith(
      API_ERROR_TOAST_MESSAGES.NOT_FOUND,
      expect.any(Object),
    );
  });

  it('never leaks the raw server message to the toast', () => {
    const err = new TycoonApiError({
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
      message: 'SELECT * FROM users — syntax error',
    });

    toastApiError(err);

    const [calledMessage] = mockError.mock.calls[0] as [string, unknown];
    expect(calledMessage).not.toContain('SELECT');
    expect(calledMessage).toBe(API_ERROR_TOAST_MESSAGES.INTERNAL_SERVER_ERROR);
  });

  it('falls back to UNKNOWN message for a plain Error', () => {
    toastApiError(new Error('something broke'));

    expect(mockError).toHaveBeenCalledOnce();
    expect(mockError).toHaveBeenCalledWith(
      API_ERROR_TOAST_MESSAGES.UNKNOWN,
      undefined,
    );
  });

  it('falls back to UNKNOWN message for null', () => {
    toastApiError(null);

    expect(mockError).toHaveBeenCalledWith(
      API_ERROR_TOAST_MESSAGES.UNKNOWN,
      undefined,
    );
  });

  it('falls back to UNKNOWN message for undefined', () => {
    toastApiError(undefined);

    expect(mockError).toHaveBeenCalledWith(
      API_ERROR_TOAST_MESSAGES.UNKNOWN,
      undefined,
    );
  });

  it('falls back to UNKNOWN message for a plain object', () => {
    toastApiError({ status: 500, message: 'oops' });

    expect(mockError).toHaveBeenCalledWith(
      API_ERROR_TOAST_MESSAGES.UNKNOWN,
      undefined,
    );
  });

  it('merges caller-supplied overrideOptions into the toast call', () => {
    const err = new TycoonApiError({
      code: 'CONFLICT',
      statusCode: 409,
      message: 'conflict',
    });

    toastApiError(err, { autoClose: 1000 });

    const [, options] = mockError.mock.calls[0] as [string, Record<string, unknown>];
    expect(options).toMatchObject({ autoClose: 1000 });
  });

  it('caller overrideOptions take precedence over code-level defaults', () => {
    const err = new TycoonApiError({
      code: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'unauthorized',
    });

    // UNAUTHORIZED default is 8000; caller overrides to 2000
    toastApiError(err, { autoClose: 2000 });

    const [, options] = mockError.mock.calls[0] as [string, Record<string, unknown>];
    expect(options.autoClose).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// toastApiError — per-code message spot-checks
// ---------------------------------------------------------------------------

describe('toastApiError — per-code messages', () => {
  const cases: Array<[ApiErrorCode, number]> = [
    ['UNAUTHORIZED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['VALIDATION_ERROR', 400],
    ['CONFLICT', 409],
    ['RATE_LIMIT', 429],
    ['INTERNAL_SERVER_ERROR', 500],
    ['NETWORK_ERROR', 0],
    ['TIMEOUT', 408],
    ['UNKNOWN', 0],
  ];

  it.each(cases)(
    'shows the correct message for code %s (status %i)',
    (code, statusCode) => {
      const err = new TycoonApiError({ code, statusCode, message: 'raw' });
      toastApiError(err);

      expect(mockError).toHaveBeenCalledWith(
        API_ERROR_TOAST_MESSAGES[code],
        expect.any(Object),
      );

      vi.clearAllMocks();
    },
  );
});

// ---------------------------------------------------------------------------
// toastApiError — stale / disconnected / invalid states
// ---------------------------------------------------------------------------

describe('toastApiError — stale and disconnected states', () => {
  it('handles a NETWORK_ERROR (offline) gracefully', () => {
    const err = new TycoonApiError({
      code: 'NETWORK_ERROR',
      statusCode: 0,
      message: 'Failed to fetch',
    });

    expect(() => toastApiError(err)).not.toThrow();
    expect(mockError).toHaveBeenCalledOnce();
  });

  it('handles a TIMEOUT (stale request) gracefully', () => {
    const err = new TycoonApiError({
      code: 'TIMEOUT',
      statusCode: 408,
      message: 'Request timed out after 10000ms',
    });

    expect(() => toastApiError(err)).not.toThrow();
    expect(mockError).toHaveBeenCalledOnce();
  });

  it('handles an UNAUTHORIZED error (expired session) gracefully', () => {
    const err = new TycoonApiError({
      code: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'jwt expired',
    });

    expect(() => toastApiError(err)).not.toThrow();
    expect(mockError).toHaveBeenCalledOnce();
  });

  it('does not throw when called with a string', () => {
    expect(() => toastApiError('something went wrong')).not.toThrow();
    expect(mockError).toHaveBeenCalledOnce();
  });

  it('does not throw when called with a number', () => {
    expect(() => toastApiError(500)).not.toThrow();
    expect(mockError).toHaveBeenCalledOnce();
  });

  it('deduplication: calling toastApiError twice with the same error does not throw', () => {
    const err = new TycoonApiError({
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
      message: 'server error',
    });

    expect(() => {
      toastApiError(err);
      toastApiError(err);
    }).not.toThrow();
  });
});
