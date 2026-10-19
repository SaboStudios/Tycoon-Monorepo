import { ConfigService } from '@nestjs/config';
import {
  ShopApiClient,
  ShopApiUnavailableError,
} from './shop-api.client';

describe('ShopApiClient purchase contract', () => {
  const configValues: Record<string, string> = {
    SHOP_API_URL: 'https://shop-api.test',
    SHOP_API_KEY: 'ci-service-key',
    SHOP_API_TIMEOUT_MS: '1000',
  };
  let client: ShopApiClient;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;
    client = new ShopApiClient(config);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forwards the service key, request id, and idempotency key', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ id: 'purchase-1', userId: 'shop-user-1' }), {
        status: 201,
      }),
    );

    const result = await client.createPurchase({
      userId: 'backend-user-1',
      sku: 'sku-1',
      quantity: 1,
      amountMinor: 250,
      currency: 'USD',
      idempotencyKey: 'purchase-key-1',
      requestId: 'request-1',
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe('https://shop-api.test/purchases');
    expect(headers.get('x-api-key')).toBe('ci-service-key');
    expect(headers.get('x-request-id')).toBe('request-1');
    expect(headers.get('idempotency-key')).toBe('purchase-key-1');
    expect(result).toMatchObject({
      ok: true,
      status: 201,
      replayed: false,
      purchaseId: 'purchase-1',
      shopUserId: 'shop-user-1',
    });
  });

  it('preserves a 409 idempotency conflict as an error, not a replay', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Payload conflict' },
        }),
        { status: 409 },
      ),
    );

    const result = await client.createPurchase({
      userId: 'backend-user-1',
      sku: 'sku-1',
      quantity: 1,
      amountMinor: 250,
      currency: 'USD',
      idempotencyKey: 'purchase-key-1',
      requestId: 'request-1',
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      replayed: false,
      error: 'Payload conflict',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fails closed when service credentials or the base URL are missing', async () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'SHOP_API_KEY' ? 'ci-service-key' : undefined,
      ),
    } as unknown as ConfigService;
    const unconfiguredClient = new ShopApiClient(config);

    await expect(
      unconfiguredClient.createPurchase({
        userId: 'backend-user-1',
        sku: 'sku-1',
        quantity: 1,
        amountMinor: 250,
        currency: 'USD',
        idempotencyKey: 'purchase-key-1',
        requestId: 'request-1',
      }),
    ).rejects.toBeInstanceOf(ShopApiUnavailableError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed on a transport error and does not retry a write', async () => {
    fetchSpy.mockRejectedValue(new Error('connection refused'));

    await expect(
      client.createPurchase({
        userId: 'backend-user-1',
        sku: 'sku-1',
        quantity: 1,
        amountMinor: 250,
        currency: 'USD',
        idempotencyKey: 'purchase-key-1',
        requestId: 'request-1',
      }),
    ).rejects.toBeInstanceOf(ShopApiUnavailableError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});