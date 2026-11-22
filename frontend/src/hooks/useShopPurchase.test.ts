import { renderHook, act } from '@testing-library/react';
import { buildIdempotencyKey, useShopPurchase } from './useShopPurchase';

const ok = (body: any, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

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
    global.fetch = jest.fn();
  });

  it('reuses the same Idempotency-Key for the same payload', async () => {
    (fetch as jest.Mock).mockReturnValue(ok({ orderId: 'o1' }));
    const { result } = renderHook(() => useShopPurchase());
    await act(async () => {
      await result.current.purchase({ sku: 'skin-1', quantity: 2 });
    });
    await act(async () => {
      await result.current.purchase({ sku: 'skin-1', quantity: 2 });
    });
    const keys = (fetch as jest.Mock).mock.calls.map(
      ([, init]: [string, RequestInit]) =>
        (init.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('uses a different Idempotency-Key when the quantity changes', async () => {
    (fetch as jest.Mock).mockReturnValue(ok({ orderId: 'o1' }));
    const { result } = renderHook(() => useShopPurchase());
    await act(async () => {
      await result.current.purchase({ sku: 'skin-1', quantity: 2 });
    });
    await act(async () => {
      await result.current.purchase({ sku: 'skin-1', quantity: 3 });
    });
    const keys = (fetch as jest.Mock).mock.calls.map(
      ([, init]: [string, RequestInit]) =>
        (init.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys[0]).not.toBe(keys[1]);
  });
});
