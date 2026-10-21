import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  ApiError,
  apiRequest,
  generateIdempotencyKey,
  purchasePayloadFingerprint,
  getIdempotencyKeyForPurchase,
  clearIdempotencyKeyForPurchase,
} from "./api";

const payload = { sku: "sku_gold_pack_100", quantity: 1 };

describe("idempotency key lifecycle", () => {
  beforeEach(() => {
    // Isolate the module-level cache between tests.
    clearIdempotencyKeyForPurchase(payload);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the same key for the same payload across calls (reuse on retry)", () => {
    const first = getIdempotencyKeyForPurchase(payload);
    const second = getIdempotencyKeyForPurchase(payload);

    expect(first).toBe(second);
    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
  });

  it("returns a different key when the quantity changes", () => {
    const before = getIdempotencyKeyForPurchase(payload);
    clearIdempotencyKeyForPurchase(payload);

    const after = getIdempotencyKeyForPurchase({ ...payload, quantity: 2 });
    expect(after).not.toBe(before);
  });

  it("returns a different key when the sku changes", () => {
    const before = getIdempotencyKeyForPurchase(payload);

    const after = getIdempotencyKeyForPurchase({ ...payload, sku: "sku_other" });
    expect(after).not.toBe(before);
  });

  it("generates a new key for the same payload after clearing the cache", () => {
    const before = getIdempotencyKeyForPurchase(payload);
    clearIdempotencyKeyForPurchase(payload);

    const after = getIdempotencyKeyForPurchase(payload);
    expect(after).not.toBe(before);
  });

  describe("generateIdempotencyKey", () => {
    it("returns a non-empty string and distinct values across calls", () => {
      const first = generateIdempotencyKey();
      const second = generateIdempotencyKey();

      expect(typeof first).toBe("string");
      expect(first.length).toBeGreaterThan(0);
      expect(first).not.toBe(second);
    });

    it("falls back to a 32-char hex string when randomUUID is unavailable", () => {
      const original = globalThis.crypto;
      try {
        vi.stubGlobal("crypto", {});
        const key = generateIdempotencyKey();

        expect(typeof key).toBe("string");
        expect(key.length).toBe(32);
        expect(/^[0-9a-f]{32}$/.test(key)).toBe(true);
      } finally {
        globalThis.crypto = original;
      }
    });
  });
});

describe("purchasePayloadFingerprint", () => {
  it("is stable for identical payloads", () => {
    expect(purchasePayloadFingerprint(payload)).toBe(
      purchasePayloadFingerprint(payload),
    );
  });

  it("differs when sku or quantity changes", () => {
    expect(purchasePayloadFingerprint(payload)).not.toBe(
      purchasePayloadFingerprint({ ...payload, quantity: 2 }),
    );
    expect(purchasePayloadFingerprint(payload)).not.toBe(
      purchasePayloadFingerprint({ ...payload, sku: "sku_other" }),
    );
  });
});

afterEach(() => vi.unstubAllGlobals());

function mockFetch(response: Pick<Response, 'ok' | 'status' | 'json'>) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response as Response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('apiRequest', () => {
  it('returns the parsed JSON body and defaults to JSON content type', async () => {
    const body = { id: 42 };
    const fetch = mockFetch({ ok: true, status: 200, json: vi.fn().mockResolvedValue(body) });
    await expect(apiRequest('/shop')).resolves.toEqual(body);
    const headers = fetch.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('returns an empty object for 204 without parsing a body', async () => {
    const json = vi.fn().mockRejectedValue(new SyntaxError('Empty body'));
    mockFetch({ ok: true, status: 204, json });
    await expect(apiRequest('/shop')).resolves.toEqual({});
    expect(json).not.toHaveBeenCalled();
  });

  it('preserves the response status, code and message in ApiError', async () => {
    mockFetch({ ok: false, status: 409, json: vi.fn().mockResolvedValue({ message: 'Already purchased', code: 'CONFLICT' }) });
    const error = await apiRequest('/shop').catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Already purchased' });
  });

  it('uses the fallback message when the error body is not JSON', async () => {
    mockFetch({ ok: false, status: 502, json: vi.fn().mockRejectedValue(new SyntaxError('HTML response')) });
    const error = await apiRequest('/shop').catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, message: 'Something went wrong', code: undefined });
  });

  it('sets bearer authorization and lets fetch set multipart content type', async () => {
    const fetch = mockFetch({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) });
    const body = new FormData();
    body.append('file', 'contents');
    await apiRequest('/upload', { method: 'POST', token: 'test-token', body });
    const options = fetch.mock.calls[0][1];
    const headers = options?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-token');
    expect(headers.has('Content-Type')).toBe(false);
    expect(options?.body).toBe(body);
  });
});
