/** Shape of a single order record from the payment provider */
export interface ProviderOrder {
  transactionId: string;
  purchaseId?: number;
  amount: number;
  currency: string;
  status: string;
}

/** Minimal interface so the service can be swapped for real provider clients */
export interface IPaymentProviderClient {
  fetchOrders(startDate: Date, endDate: Date): Promise<ProviderOrder[]>;
}
