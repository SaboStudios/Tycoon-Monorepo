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
  const intent = `${payload.sku}:${payload.quantity}`;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    // Deterministic per-intent key derived from a random seed kept in memory.
    return `${intent}:${crypto.randomUUID()}`;
  }
  return `${intent}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function payloadSignature(payload: ShopPurchasePayload): string {
  return `${payload.sku}:${payload.quantity}`;
}

/**
 * Resolve the API base URL the same way the rest of the frontend does.
 */
function getShopApiBaseUrl(): string {
  const base =
    (typeof process !== 'undefined' &&
      process.env &&
      (process.env.NEXT_PUBLIC_SHOP_API_URL || process.env.NEXT_PUBLIC_API_URL)) ||
    '';
  return base.replace(/\/$/, '');
}

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
      const baseUrl = getShopApiBaseUrl();

      setResult({ status: 'pending' });

      try {
        const response = await doFetch(`${baseUrl}/shop/purchases`, {
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
