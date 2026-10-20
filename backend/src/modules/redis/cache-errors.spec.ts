/**
 * SW-BE-007 — Cache error mapping tests.
 */
import { HttpStatus } from '@nestjs/common';
import {
  CacheErrorCode,
  CacheValidationException,
  CacheOperationException,
  mapCacheError,
} from './errors/cache.errors';

describe('CacheValidationException', () => {
  it('has status 400', () => {
    const ex = new CacheValidationException(CacheErrorCode.INVALID_KEY, 'bad key');
    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('includes errorCode and message in response body', () => {
    const ex = new CacheValidationException(CacheErrorCode.INVALID_TTL, 'bad ttl', 'must be > 0');
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body.errorCode).toBe(CacheErrorCode.INVALID_TTL);
    expect(body.message).toBe('bad ttl');
    expect(body.detail).toBe('must be > 0');
  });

  it('omits detail when not provided', () => {
    const ex = new CacheValidationException(CacheErrorCode.INVALID_KEY, 'bad key');
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body).not.toHaveProperty('detail');
  });
});

describe('CacheOperationException', () => {
  it('has status 500', () => {
    const ex = new CacheOperationException('Cache set failed');
    expect(ex.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('includes OPERATION_FAILED errorCode', () => {
    const ex = new CacheOperationException('Cache set failed');
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body.errorCode).toBe(CacheErrorCode.OPERATION_FAILED);
  });
});

describe('mapCacheError', () => {
  it('wraps an Error into CacheOperationException', () => {
    const ex = mapCacheError(new Error('connection refused'), 'get');
    expect(ex).toBeInstanceOf(CacheOperationException);
    expect(ex.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('wraps a non-Error value', () => {
    const ex = mapCacheError('timeout', 'set');
    expect(ex).toBeInstanceOf(CacheOperationException);
  });

  it('redacts IP addresses from the detail', () => {
    const ex = mapCacheError(new Error('connect ECONNREFUSED 192.168.1.10:6379'), 'get');
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body.detail).not.toMatch(/192\.168/);
    expect(body.detail).toContain('[host]');
  });

  it('redacts password fragments from the detail', () => {
    const ex = mapCacheError(new Error('auth failed password=secret123'), 'set');
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body.detail).not.toContain('secret123');
    expect(body.detail).toContain('[redacted]');
  });

  it('redacts credentials in redis:// URLs', () => {
    const ex = mapCacheError(new Error('redis://:mypassword@localhost:6379'), 'del');
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body.detail).not.toContain('mypassword');
  });

  it('includes the operation name in the message', () => {
    const ex = mapCacheError(new Error('down'), 'scanPage');
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body.message).toContain('scanPage');
  });
});
