/**
 * SW-BE-007 — DTO validation tests for cache operations.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CacheSetDto,
  CacheGetDto,
  CacheDelDto,
  CacheScanPageDto,
  CACHE_TTL_MAX_SECONDS,
} from './dto/cache-operation.dto';

async function errors<T extends object>(
  Cls: new () => T,
  plain: object,
): Promise<string[]> {
  const instance = plainToInstance(Cls, plain);
  const result = await validate(instance as object);
  return result.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CacheGetDto', () => {
  it('accepts a valid key', async () => {
    expect(await errors(CacheGetDto, { key: 'shop:items:1' })).toHaveLength(0);
  });

  it('rejects an empty key', async () => {
    expect(await errors(CacheGetDto, { key: '' })).not.toHaveLength(0);
  });

  it('rejects a key longer than 512 chars', async () => {
    expect(await errors(CacheGetDto, { key: 'a'.repeat(513) })).not.toHaveLength(0);
  });

  it('rejects a key with illegal characters', async () => {
    expect(await errors(CacheGetDto, { key: 'bad key!' })).not.toHaveLength(0);
  });

  it('accepts keys with colon, underscore, hyphen, dot, asterisk', async () => {
    expect(await errors(CacheGetDto, { key: 'prefix:sub_key-v1.0*' })).toHaveLength(0);
  });
});

describe('CacheSetDto', () => {
  it('accepts valid key, value and ttl', async () => {
    expect(
      await errors(CacheSetDto, { key: 'shop:items', value: { id: 1 }, ttl: 300 }),
    ).toHaveLength(0);
  });

  it('accepts without optional ttl', async () => {
    expect(await errors(CacheSetDto, { key: 'k', value: 'v' })).toHaveLength(0);
  });

  it('rejects ttl of 0', async () => {
    expect(await errors(CacheSetDto, { key: 'k', value: 'v', ttl: 0 })).not.toHaveLength(0);
  });

  it('rejects ttl exceeding max', async () => {
    expect(
      await errors(CacheSetDto, { key: 'k', value: 'v', ttl: CACHE_TTL_MAX_SECONDS + 1 }),
    ).not.toHaveLength(0);
  });

  it('rejects empty value', async () => {
    expect(await errors(CacheSetDto, { key: 'k', value: '' })).not.toHaveLength(0);
  });

  it('rejects invalid key', async () => {
    expect(await errors(CacheSetDto, { key: 'bad key!', value: 'v' })).not.toHaveLength(0);
  });
});

describe('CacheDelDto', () => {
  it('accepts a valid key', async () => {
    expect(await errors(CacheDelDto, { key: 'session:abc' })).toHaveLength(0);
  });

  it('rejects missing key', async () => {
    expect(await errors(CacheDelDto, {})).not.toHaveLength(0);
  });
});

describe('CacheScanPageDto', () => {
  it('accepts valid pattern with defaults', async () => {
    expect(await errors(CacheScanPageDto, { pattern: 'shop:*' })).toHaveLength(0);
  });

  it('accepts explicit cursor and count', async () => {
    expect(
      await errors(CacheScanPageDto, { pattern: 'shop:*', cursor: 42, count: 100 }),
    ).toHaveLength(0);
  });

  it('rejects count > 500', async () => {
    expect(
      await errors(CacheScanPageDto, { pattern: 'shop:*', count: 501 }),
    ).not.toHaveLength(0);
  });

  it('rejects negative cursor', async () => {
    expect(
      await errors(CacheScanPageDto, { pattern: 'shop:*', cursor: -1 }),
    ).not.toHaveLength(0);
  });

  it('rejects empty pattern', async () => {
    expect(await errors(CacheScanPageDto, { pattern: '' })).not.toHaveLength(0);
  });
});
