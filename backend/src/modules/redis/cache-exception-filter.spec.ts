/**
 * SW-BE-007 — CacheExceptionFilter unit tests.
 */
import { HttpStatus } from '@nestjs/common';
import { CacheExceptionFilter } from './cache-exception.filter';
import {
  CacheErrorCode,
  CacheValidationException,
  CacheOperationException,
} from './errors/cache.errors';

const makeHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
    status,
    json,
  } as any;
};

describe('CacheExceptionFilter', () => {
  let filter: CacheExceptionFilter;

  beforeEach(() => {
    filter = new CacheExceptionFilter();
  });

  it('returns 400 with errorCode and detail for CacheValidationException', () => {
    const host = makeHost();
    const ex = new CacheValidationException(
      CacheErrorCode.INVALID_KEY,
      'bad key',
      'key must match pattern',
    );
    filter.catch(ex, host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(host.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: CacheErrorCode.INVALID_KEY,
        message: 'bad key',
        detail: 'key must match pattern',
      }),
    );
  });

  it('omits detail for 500 CacheOperationException', () => {
    const host = makeHost();
    const ex = new CacheOperationException('Cache get failed', 'connection refused');
    filter.catch(ex, host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const call = host.json.mock.calls[0][0] as Record<string, unknown>;
    expect(call.errorCode).toBe(CacheErrorCode.OPERATION_FAILED);
    expect(call).not.toHaveProperty('detail');
  });

  it('always includes a timestamp', () => {
    const host = makeHost();
    filter.catch(new CacheOperationException('fail'), host);
    const call = host.json.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof call.timestamp).toBe('string');
  });
});
