import { describe, expect, it } from 'vitest';

import {
  analyticsEventSchema,
  getViewEventForPath,
  sanitizeAnalyticsPayload,
} from './taxonomy';

/**
 * SW-FE-1761 documents the PII keys that `sanitizeAnalyticsPayload` must drop
 * and the value shapes it must redact. These tests pin that behaviour so a
 * regression that stops scrubbing a key fails the build gate.
 */
describe('sanitizeAnalyticsPayload', () => {
  it('drops documented PII keys', () => {
    const piiKeys = [
      'email',
      'walletAddress',
      'wallet_address',
      'accountId',
      'account_id',
      'token',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'privateKey',
      'private_key',
      'secret',
      'password',
      'authorization',
      'cookie',
      'ip',
      'ipAddress',
      'ip_address',
      'userAgent',
      'user_agent',
    ];

    const payload: Record<string, unknown> = { event: 'page_view' };
    for (const key of piiKeys) {
      payload[key] = 'sensitive-value';
    }

    const sanitized = sanitizeAnalyticsPayload(payload);

    for (const key of piiKeys) {
      expect(sanitized).not.toHaveProperty(key);
    }
  });

  it('redacts values that look like emails, NEAR accounts, hex keys, hashes, base32 keys or JWTs', () => {
    const sanitized = sanitizeAnalyticsPayload({
      event: 'page_view',
      note: 'contact me at alice@example.com',
      account: 'alice.near',
      hexKey: 'a'.repeat(64),
      hash: '0x' + 'b'.repeat(64),
      publicKey: 'ed25519:' + 'C'.repeat(44),
      jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
    });

    expect(sanitized.note).toBeUndefined();
    expect(sanitized.account).toBeUndefined();
    expect(sanitized.hexKey).toBeUndefined();
    expect(sanitized.hash).toBeUndefined();
    expect(sanitized.publicKey).toBeUndefined();
    expect(sanitized.jwt).toBeUndefined();
  });

  it('strips query strings and fragments from route', () => {
    const sanitized = sanitizeAnalyticsPayload({
      event: 'page_view',
      route: '/dashboard?email=alice@example.com#token=abc',
    });

    expect(sanitized.route).toBe('/dashboard');
  });

  it('drops strings longer than 200 characters', () => {
    const sanitized = sanitizeAnalyticsPayload({
      event: 'page_view',
      note: 'x'.repeat(201),
    });

    expect(sanitized.note).toBeUndefined();
  });

  it('keeps non-PII keys intact', () => {
    const sanitized = sanitizeAnalyticsPayload({
      event: 'page_view',
      route: '/dashboard',
      referrer: 'https://example.com',
      count: 3,
      enabled: true,
    });

    expect(sanitized).toMatchObject({
      event: 'page_view',
      route: '/dashboard',
      referrer: 'https://example.com',
      count: 3,
      enabled: true,
    });
  });

  it('recurses into nested objects and drops PII keys there too', () => {
    const sanitized = sanitizeAnalyticsPayload({
      event: 'page_view',
      meta: {
        route: '/dashboard',
        email: 'alice@example.com',
        nested: { token: 'abc', count: 1 },
      },
    });

    expect(sanitized.meta).toMatchObject({ route: '/dashboard' });
    expect((sanitized.meta as Record<string, unknown>).email).toBeUndefined();
    expect(
      ((sanitized.meta as Record<string, unknown>).nested as Record<string, unknown>)
        .token,
    ).toBeUndefined();
    expect(
      ((sanitized.meta as Record<string, unknown>).nested as Record<string, unknown>)
        .count,
    ).toBe(1);
  });
});

describe('analyticsEventSchema', () => {
  it('rejects a payload that still contains a PII key', () => {
    const result = analyticsEventSchema.safeParse({
      event: 'page_view',
      route: '/dashboard',
      email: 'alice@example.com',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a sanitized payload', () => {
    const result = analyticsEventSchema.safeParse({
      event: 'page_view',
      route: '/dashboard',
    });

    expect(result.success).toBe(true);
  });
});

describe('getViewEventForPath', () => {
  it('returns a view event for a path', () => {
    const event = getViewEventForPath('/dashboard');

    expect(event).toMatchObject({ event: 'page_view', route: '/dashboard' });
  });
});
