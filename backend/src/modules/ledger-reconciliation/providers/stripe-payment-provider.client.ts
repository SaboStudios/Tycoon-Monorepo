import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IPaymentProviderClient,
  ProviderOrder,
} from '../interfaces/payment-provider.interface';

interface StripePaymentIntent {
  id: string;
  amount_received: number;
  currency: string;
  status: string;
  metadata?: { purchaseId?: string };
}

interface StripeListResponse {
  data: StripePaymentIntent[];
  has_more: boolean;
}

@Injectable()
export class StripePaymentProviderClient implements IPaymentProviderClient {
  constructor(private readonly config: ConfigService) {}

  async fetchOrders(startDate: Date, endDate: Date): Promise<ProviderOrder[]> {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required for the stripe provider');
    }

    const orders: ProviderOrder[] = [];
    let startingAfter: string | undefined;

    do {
      const query = new URLSearchParams({
        limit: '100',
        'created[gte]': String(Math.floor(startDate.getTime() / 1000)),
        'created[lte]': String(Math.floor(endDate.getTime() / 1000)),
      });
      if (startingAfter) query.set('starting_after', startingAfter);

      const response = await fetch(
        `https://api.stripe.com/v1/payment_intents?${query.toString()}`,
        {
          headers: { Authorization: `Bearer ${secretKey}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) {
        throw new Error(`Stripe reconciliation request failed (${response.status})`);
      }

      const page = (await response.json()) as StripeListResponse;
      orders.push(...page.data.map((intent) => this.toProviderOrder(intent)));
      startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
      if (page.has_more && !startingAfter) {
        throw new Error('Stripe returned an invalid pagination response');
      }
    } while (startingAfter);

    return orders;
  }

  private toProviderOrder(intent: StripePaymentIntent): ProviderOrder {
    const purchaseId = Number(intent.metadata?.purchaseId);
    return {
      transactionId: intent.id,
      purchaseId: Number.isInteger(purchaseId) ? purchaseId : undefined,
      amount: intent.amount_received / 100,
      currency: intent.currency.toUpperCase(),
      status: this.normalizeStatus(intent.status),
    };
  }

  private normalizeStatus(status: string): string {
    if (status === 'succeeded') return 'completed';
    if (status === 'canceled') return 'cancelled';
    return status;
  }
}
