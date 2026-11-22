import { useCallback, useRef, useState } from 'react';

/**
 * Shop purchase hook.
 *
 * Generates a stable Idempotency-Key per purchase intent (SKU + quantity).
 * The key is reused across network retries/reconnects for the same payload,
 * and regenerated whenever the payload changes so a new intent gets a new key.
 *
 * shop-api enforces Idempotency-Key with a body hash: replays return the stored
 * response, and a payload conflict returns HTTP 409. We surface 409 as a
 * distinct UX state rather than a generic error.
 */

export type ShopPurchaseStatus =
  | 'idle'
  | 'pending'
  | 'success'
  | 'conflict'
  | 'error';

export interface ShopPurchasePayload {
  sku: string;
  quantity: number;
}

export interface ShopPurchaseResult {
  status: ShopPurchaseStatus;
  data?: unknown;
  error?: string;
}

/**
 * Build a stable key for a purchase intent. Same SKU + quantity => same key,
 * so retries/reconnects reuse it; a different payload yields a different key.
 */
export function buildIdempotencyKey(payload: ShopPurchasePayload): string {
  // Pure function of the intent: no clock, no randomness. Retries of the same
  // SKU + quantity reuse the key; a different payload yields a different key.
  return `shop-purchase:${payload.sku}:${payload.quantity}`;
}

function payloadSignature(payload: ShopPurchasePayload): string {
  return `${payload.sku}:${payload.quantity}`;
}

/**
 * Single source of truth for the purchase endpoint.
 *
 * Always a same-origin relative path so the Next rewrite / route handler
 * forwards it to shop-api. Never build this from an env base URL: an empty
 * base would otherwise resolve to an unexpected host.
 */
export const SHOP_PURCHASES_PATH = '/api/shop/purchases';

export interface UseShopPurchaseOptions {
  /** Optional override for tests / custom clients. */
  fetchImpl?: typeof fetch;
}

export function useShopPurchase(options: UseShopPurchaseOptions = {}) {
  const [result, setResult] = useState<ShopPurchaseResult>({ status: 'idle' });

  // Cache the key per payload signature so retries reuse it and payload
  // changes regenerate it.
  const keyRef = useRef<{ signature: string; key: string } | null>(null);

  const getKeyForPayload = useCallback((payload: ShopPurchasePayload): string => {
    const signature = payloadSignature(payload);
    if (keyRef.current && keyRef.current.signature === signature) {
      return keyRef.current.key;
    }
    const key = buildIdempotencyKey(payload);
    keyRef.current = { signature, key };
    return key;
  }, []);

  const purchase = useCallback(
    async (payload: ShopPurchasePayload): Promise<ShopPurchaseResult> => {
      const idempotencyKey = getKeyForPayload(payload);
      const doFetch = options.fetchImpl ?? fetch;

      setResult({ status: 'pending' });

      try {
        const response = await doFetch(SHOP_PURCHASES_PATH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 409) {
          // Payload conflict / duplicate intent: distinct UX state, not a
          // generic error. The key is retained so the user can reconcile.
          const conflict: ShopPurchaseResult = {
            status: 'conflict',
            error: 'This purchase conflicts with a previous request for the same item.',
          };
          setResult(conflict);
          return conflict;
        }

        if (!response.ok) {
          const failure: ShopPurchaseResult = {
            status: 'error',
            error: `Purchase failed (${response.status}).`,
          };
          setResult(failure);
          return failure;
        }

        const data = await response.json().catch(() => undefined);
        const success: ShopPurchaseResult = { status: 'success', data };
        setResult(success);
        return success;
      } catch (err) {
        // Network failure: keep the same key so a retry/reconnect replays the
        // same intent instead of creating a duplicate purchase.
        const failure: ShopPurchaseResult = {
          status: 'error',
          error: err instanceof Error ? err.message : 'Network error during purchase.',
        };
        setResult(failure);
        return failure;
      }
    },
    [getKeyForPayload, options.fetchImpl],
  );

  const reset = useCallback(() => {
    keyRef.current = null;
    setResult({ status: 'idle' });
  }, []);

  return { purchase, reset, result };
}

export default useShopPurchase;
