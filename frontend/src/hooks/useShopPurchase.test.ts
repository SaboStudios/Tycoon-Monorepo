import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { buildIdempotencyKey, useShopPurchase } from './useShopPurchase';

const ok = (body: any, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

const conflict = (body: any = { message: 'Conflict' }) =>
  Promise.resolve({ ok: false, status: 409, json: async () => body } as Response);

describe('buildIdempotencyKey', () => {
  it('returns the same key for the same SKU and quantity', () => {
    const a = buildIdempotencyKey({ sku: 'skin-1', quantity: 2 });
    const b = buildIdempotencyKey({ sku: 'skin-1', quantity: 2 });
    expect(a).toBe(b);
  });

  it('returns a different key for a different quantity', () => {
    const a = buildIdempotencyKey({ sku: 'skin-1', quantity: 2 });
    const b = buildIdempotencyKey({ sku: 'skin-1', quantity: 3 });
    expect(a).not.toBe(b);
  });

  it('does not embed a timestamp or UUID', () => {
    const key = buildIdempotencyKey({ sku: 'skin-1', quantity: 2 });
    expect(key).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(key).not.toContain(Date.now().toString(36));
  });
});

describe('useShopPurchase', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('reuses the same Idempotency-Key for the same payload', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(ok({ orderId: 'o1' }));
    const { result } = renderHook(() => useShopPurchase());
    await act(async () => {
      await result.current.purchase({ sku: 'skin-1', quantity: 2 });
    });
    await act(async () => {
      await result.current.purchase({ sku: 'skin-1', quantity: 2 });
    });
    const keys = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(
      ([, init]: [string, RequestInit]) =>
        (init.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('uses a different Idempotency-Key when the quantity changes', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(ok({ orderId: 'o1' }));
    const { result } = renderHook(() => useShopPurchase());
    await act(async () => {
      await result.current.purchase({ sku: 'skin-1', quantity: 2 });
    });
    await act(async () => {
      await result.current.purchase({ sku: 'skin-1', quantity: 3 });
    });
    const keys = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(
      ([, init]: [string, RequestInit]) =>
        (init.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys[0]).not.toBe(keys[1]);
  });

  // #2163: a mocked 409 must resolve to the distinct `conflict` status, not a
  // generic `error`, and must not retry the request on its own.
  it('resolves a 409 response to status "conflict", not "error", and calls fetch once', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(conflict());
    const { result } = renderHook(() => useShopPurchase());

    let purchaseResult: Awaited<ReturnType<typeof result.current.purchase>> | undefined;
    await act(async () => {
      purchaseResult = await result.current.purchase({ sku: 'skin-1', quantity: 2 });
    });

    expect(purchaseResult?.status).toBe('conflict');
    expect(purchaseResult?.status).not.toBe('error');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // #2162: shop-api's idempotency contract depends on this exact header name.
  // A rename would silently disable deduplication, so pin it in a test.
  it('sends a non-empty Idempotency-Key header on the POST purchase request', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(ok({ orderId: 'o1' }));
    const { result } = renderHook(() => useShopPurchase());

    await act(async () => {
      await result.current.purchase({ sku: 'skin-1', quantity: 2 });
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    const headerValue = (init.headers as Record<string, string>)['Idempotency-Key'];
    expect(typeof headerValue).toBe('string');
    expect(headerValue.length).toBeGreaterThan(0);
  });
});
