import { useCallback, useRef, useState } from 'react';

import { isValidPurchasePayload, mapShopPurchaseError, readShopPurchaseErrorMessage } from '../lib/api';

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

/**
 * The documented success body from shop-api: a JSON object carrying the
 * created order's id. Anything else (empty object, non-object, missing id)
 * is not a successful purchase.
 */
export interface ShopPurchaseOrder {
  orderId: string;
  [key: string]: unknown;
}

export interface ShopPurchaseResult {
  status: ShopPurchaseStatus;
  data?: ShopPurchaseOrder;
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
export interface ShopPurchaseOrder {
  orderId: string;
  [key: string]: unknown;
}

export function parsePurchaseOrder(body: unknown): ShopPurchaseOrder | null {
  // Only a JSON object carrying a non-empty string orderId is a success.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }
  const orderId = (body as { orderId?: unknown }).orderId;
  if (typeof orderId !== 'string' || orderId.trim() === '') {
    return null;
  }
  return body as ShopPurchaseOrder;
}

const INVALID_RESPONSE_ERROR =
  'Purchase response was invalid: the server did not return an order id. Please retry.';

/**
 * Resolve the API base URL the same way the rest of the frontend does.
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
      // Reject invalid payloads before generating a key or calling fetch.
      if (!isValidPurchasePayload(payload)) {
        const invalid: ShopPurchaseResult = {
          status: 'error',
          error: 'Quantity must be a whole number of at least 1.',
        };
        setResult(invalid);
        return invalid;
      }

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

        if (!response.ok) {
          const mapped = mapShopPurchaseError(
            response.status,
            await readShopPurchaseErrorMessage(response),
          );
          if (mapped.status === 'conflict') {
            // Payload conflict / duplicate intent: distinct UX state, not a
            // generic error. The key is retained so the user can reconcile.
            const conflict: ShopPurchaseResult = {
              status: 'conflict',
              error: mapped.message,
            };
            setResult(conflict);
            return conflict;
          }

          const failure: ShopPurchaseResult = {
            status: 'error',
            error: mapped.message,
          };
          setResult(failure);
          return failure;
        }

        const body = await response.json().catch(() => undefined);
        const order = parsePurchaseOrder(body);
        if (!order) {
          // A 2xx without the documented order id is not a success. Drop the
          // cached key so the retry is treated as a fresh attempt.
          keyRef.current = null;
          const invalid: ShopPurchaseResult = {
            status: 'error',
            error: INVALID_RESPONSE_ERROR,
          };
          setResult(invalid);
          return invalid;
        }

        const success: ShopPurchaseResult = { status: 'success', data: order };
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
