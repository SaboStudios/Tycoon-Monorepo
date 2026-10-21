import { describe, expect, it } from 'vitest';
import {
  ErrorCategory, ERROR_MESSAGES, categorizeError, sanitizeError,
  isNetworkError, isServerError, isRecoverableError, type SanitizedError,
} from './types';

describe('error categories and predicates', () => {
  it.each([
    [new TypeError('Failed to fetch: secret-token'), ErrorCategory.NETWORK, true, false, true],
    [{ status: 503, message: 'private server details' }, ErrorCategory.SERVER, false, true, true],
    [{ status: 404, message: 'private missing resource' }, ErrorCategory.NOT_FOUND, false, false, false],
    [{ status: 401, message: 'private credentials' }, ErrorCategory.AUTH, false, false, true],
    [Object.assign(new Error('Invalid private input'), { status: 422 }), ErrorCategory.VALIDATION, false, false, true],
    [new Error('private unexpected details'), ErrorCategory.UNKNOWN, false, false, true],
  ] as const)('classifies and sanitizes %o as %s', (error, category, network, server, recoverable) => {
    expect(categorizeError(error)).toBe(category);
    expect(isNetworkError(error)).toBe(network);
    expect(isServerError(error)).toBe(server);
    expect(isRecoverableError(error)).toBe(recoverable);
    const sanitized: SanitizedError = sanitizeError(error);
    expect(sanitized.category).toBe(category);
    expect(sanitized.recoverable).toBe(recoverable);
    expect(sanitized.userMessage).toBe(ERROR_MESSAGES[category].message);
    expect(Object.values(ERROR_MESSAGES).map(value => value.message)).toContain(sanitized.userMessage);
    expect(sanitized.userMessage).not.toBe(error.message);
    expect(JSON.stringify(sanitized)).not.toContain(error.message);
  });
});

it.each([undefined, 'unexpected value', { unexpected: true }])('sanitizes unknown value %o', error => {
  expect(categorizeError(error)).toBe(ErrorCategory.UNKNOWN);
  expect(sanitizeError(error).userMessage).toBe(ERROR_MESSAGES[ErrorCategory.UNKNOWN].message);
});
