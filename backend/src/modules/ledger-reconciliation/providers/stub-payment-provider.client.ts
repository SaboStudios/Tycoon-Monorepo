import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentProviderClient,
  ProviderOrder,
} from '../interfaces/payment-provider.interface';

/**
 * Stub implementation of the payment provider client.
 * Replace with a real HTTP client (e.g. Stripe, RevenueCat) when available.
 * Returns an empty list so the reconciler is safe to run read-only.
 */
@Injectable()
export class StubPaymentProviderClient implements IPaymentProviderClient {
  private readonly logger = new Logger(StubPaymentProviderClient.name);

  async fetchOrders(_start: Date, _end: Date): Promise<ProviderOrder[]> {
    this.logger.warn(
      'StubPaymentProviderClient: returning empty order list. ' +
        'Replace with a real provider client before going to production.',
    );
    return [];
  }
}
