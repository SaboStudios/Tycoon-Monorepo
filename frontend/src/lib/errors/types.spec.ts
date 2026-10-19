import { describe, it, expect } from 'vitest';
import {
  ErrorCategory,
  ERROR_MESSAGES,
  categorizeError,
  sanitizeError,
  isNetworkError,
  isServerError,
  isRecoverableError,
} from './index';

describe('categorizeError', () => {
  it('classifies a TypeError thrown by fetch as a network error', () => {
    const error = new TypeError('Failed to fetch');
    expect(categorizeError(error)).toBe(ErrorCategory.NETWORK);
  });

  it('classifies an error with a 5xx status as a server error', () => {
    const error = Object.assign(new Error('Internal Server Error'), { status: 500 });
    expect(categorizeError(error)).toBe(ErrorCategory.SERVER);
  });

  it('classifies a 4xx validation error as a validation error', () => {
    const error = Object.assign(new Error('Invalid input'), { status: 422 });
    expect(categorizeError(error)).toBe(ErrorCategory.VALIDATION);
  });

  it('classifies an unknown thrown value as unknown', () => {
    expect(categorizeError('something went wrong')).toBe(ErrorCategory.UNKNOWN);
    expect(categorizeError(undefined)).toBe(ErrorCategory.UNKNOWN);
  });
});

describe('sanitizeError', () => {
  it('does not surface the raw internal message of a server error', () => {
    const rawMessage = 'pg: connection refused at 10.0.0.5:5432';
    const error = Object.assign(new Error(rawMessage), { status: 500 });

    const sanitized = sanitizeError(error);

    expect(sanitized.category).toBe(ErrorCategory.SERVER);
    expect(sanitized.message).not.toContain(rawMessage);
    expect(sanitized.message).not.toContain('10.0.0.5');
    expect(sanitized.message).toBe(ERROR_MESSAGES[ErrorCategory.SERVER]);
  });

  it('returns a sanitized error for unknown thrown values', () => {
    const sanitized = sanitizeError({ unexpected: true });

    expect(sanitized.category).toBe(ErrorCategory.UNKNOWN);
    expect(sanitized.message).toBe(ERROR_MESSAGES[ErrorCategory.UNKNOWN]);
  });
});

describe('error predicates', () => {
  it('agree with the categories produced by categorizeError', () => {
    const network = new TypeError('Failed to fetch');
    const server = Object.assign(new Error('boom'), { status: 503 });
    const validation = Object.assign(new Error('bad request'), { status: 400 });

    expect(isNetworkError(network)).toBe(true);
    expect(isServerError(network)).toBe(false);

    expect(isServerError(server)).toBe(true);
    expect(isNetworkError(server)).toBe(false);

    expect(isNetworkError(validation)).toBe(false);
    expect(isServerError(validation)).toBe(false);
  });

  it('marks network and server errors as recoverable and validation errors as not', () => {
    const network = new TypeError('Failed to fetch');
    const server = Object.assign(new Error('boom'), { status: 500 });
    const validation = Object.assign(new Error('bad request'), { status: 400 });

    expect(isRecoverableError(network)).toBe(true);
    expect(isRecoverableError(server)).toBe(true);
    expect(isRecoverableError(validation)).toBe(false);
  });
});
