import { ConfigService } from '@nestjs/config';
import { StripePaymentProviderClient } from './stripe-payment-provider.client';

describe('StripePaymentProviderClient', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('maps recorded PaymentIntent fixtures without exposing the secret', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        has_more: false,
        data: [
          {
            id: 'pi_fixture_1',
            amount_received: 2599,
            currency: 'usd',
            status: 'succeeded',
            metadata: { purchaseId: '17' },
          },
        ],
      }),
    });
    const client = new StripePaymentProviderClient(
      new ConfigService({ STRIPE_SECRET_KEY: 'sk_test_fixture' }),
    );

    await expect(
      client.fetchOrders(
        new Date('2026-08-01T00:00:00Z'),
        new Date('2026-08-02T00:00:00Z'),
      ),
    ).resolves.toEqual([
      {
        transactionId: 'pi_fixture_1',
        purchaseId: 17,
        amount: 25.99,
        currency: 'USD',
        status: 'completed',
      },
    ]);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer sk_test_fixture',
    );
  });

  it('paginates until Stripe reports no more records', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          has_more: true,
          data: [
            {
              id: 'pi_1',
              amount_received: 100,
              currency: 'usd',
              status: 'succeeded',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ has_more: false, data: [] }),
      });
    const client = new StripePaymentProviderClient(
      new ConfigService({ STRIPE_SECRET_KEY: 'secret' }),
    );
    await client.fetchOrders(new Date(0), new Date(1000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('starting_after=pi_1');
  });

  it('fails closed when the key is missing', async () => {
    const client = new StripePaymentProviderClient(new ConfigService({}));
    await expect(client.fetchOrders(new Date(), new Date())).rejects.toThrow(
      'STRIPE_SECRET_KEY is required',
    );
  });
});
