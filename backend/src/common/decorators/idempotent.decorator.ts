import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by the idempotency guard/interceptor to discover
 * endpoints that must enforce an `Idempotency-Key` header.
 */
export const IDEMPOTENT_KEY = 'idempotent';

export interface IdempotentOptions {
  /**
   * Header name carrying the idempotency key. Defaults to `Idempotency-Key`.
   */
  header?: string;
  /**
   * How long a stored response remains replayable, in seconds.
   * Defaults to 24h. After expiry the key may be reused (see runbook).
   */
  ttlSeconds?: number;
  /**
   * When true, a replay whose request body hash differs from the stored
   * hash is rejected with 409 Conflict instead of being treated as a new
   * request. Defaults to true per docs/API_ERROR_RESPONSE_STANDARDS.md.
   */
  rejectOnPayloadConflict?: boolean;
}

/**
 * Marks a route handler as idempotent. The idempotency guard reads this
 * metadata to enforce `Idempotency-Key` semantics for money/inventory
 * mutations (shop purchases, pot ledger reconciliation admin actions).
 *
 * Usage:
 *   @Idempotent()
 *   @Post('purchases')
 *   createPurchase(@Body() dto: CreatePurchaseDto) { ... }
 */
export const Idempotent = (options: IdempotentOptions = {}) =>
  SetMetadata(IDEMPOTENT_KEY, {
    header: options.header ?? 'Idempotency-Key',
    ttlSeconds: options.ttlSeconds ?? 86_400,
    rejectOnPayloadConflict: options.rejectOnPayloadConflict ?? true,
  });
