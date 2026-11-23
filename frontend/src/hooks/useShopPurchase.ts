'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isValidPurchasePayload,
  mapShopPurchaseError,
  readShopPurchaseErrorMessage,
} from '../lib/api';

/**
 * Single source of truth for purchasing shop items.
 *
 * Owns the Idempotency-Key for a purchase intent (SKU + quantity) so there
 * is exactly one key generator and one fetch implementation shared by every
 * caller (button, future surfaces). A hung request aborts after a timeout
 * and surfaces an error while keeping the same key, so a retry of the same
 * intent is deduped server-side rather than double-charging.
 */

export const SHOP_PURCHASES_PATH = '/api/shop/purchases';

/** Default request timeout for a shop purchase, in milliseconds. */
export const PURCHASE_TIMEOUT_MS = 15_000;

const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export interface ShopPurchasePayload {
  sku: string;
  quantity: number;
}

export interface ShopPurchaseResult {
  orderId?: string;
  sku: string;
  quantity: number;
}

export interface ShopPurchaseConflict {
  sku: string;
  quantity: number;
  message: string;
}

export type ShopPurchaseStatus =
  | 'idle'
  | 'pending'
  | 'success'
  | 'conflict'
  | 'signed_out'
  | 'error';

export type PurchaseOutcome =
  | { status: 'success'; result: ShopPurchaseResult }
  | { status: 'conflict'; conflict: ShopPurchaseConflict }
  | { status: 'signed_out'; message: string }
  | { status: 'error'; message: string }
  | { status: 'skipped' };

/**
 * Stable key for a purchase intent. Pure function of the payload: no clock,
 * no randomness, so retries of the same SKU + quantity reuse the key while a
 * changed payload (new intent) gets a fresh one.
 */
export function buildIdempotencyKey(payload: ShopPurchasePayload): string {
  return `shop-purchase:${payload.sku}:${payload.quantity}`;
}

async function postPurchase(
  payload: ShopPurchasePayload,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(SHOP_PURCHASES_PATH, {
    method: 'POST',
    // Same-origin proxy route: keep the default same-origin credentials mode.
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify(payload),
    signal,
  });
}

export interface UseShopPurchaseResult {
  status: ShopPurchaseStatus;
  message: string | null;
  purchase: (payload: ShopPurchasePayload, signal?: AbortSignal) => Promise<PurchaseOutcome>;
}

export function useShopPurchase(timeoutMs: number = PURCHASE_TIMEOUT_MS): UseShopPurchaseResult {
  const [status, setStatus] = useState<ShopPurchaseStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Scoped to the current intent; reused for retries of that intent and
  // regenerated only when the payload (SKU/quantity) changes.
  const intentRef = useRef<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const statusRef = useRef<ShopPurchaseStatus>('idle');
  statusRef.current = status;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const purchase = useCallback(
    async (payload: ShopPurchasePayload, callerSignal?: AbortSignal): Promise<PurchaseOutcome> => {
      if (!isValidPurchasePayload(payload) || statusRef.current === 'pending') {
        return { status: 'skipped' };
      }

      const intent = `${payload.sku}:${payload.quantity}`;
      if (intentRef.current !== intent || !keyRef.current) {
        intentRef.current = intent;
        keyRef.current = buildIdempotencyKey(payload);
      }
      const idempotencyKey = keyRef.current;

      const controller = new AbortController();
      abortRef.current = controller;

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const onCallerAbort = () => controller.abort();
      if (callerSignal) {
        if (callerSignal.aborted) controller.abort();
        else callerSignal.addEventListener('abort', onCallerAbort);
      }

      setStatus('pending');
      setMessage(null);

      try {
        const res = await postPurchase(payload, idempotencyKey, controller.signal);

        if (!res.ok) {
          const mapped = mapShopPurchaseError(res.status, await readShopPurchaseErrorMessage(res));

          if (mapped.status === 'conflict') {
            const conflict: ShopPurchaseConflict = { ...payload, message: mapped.message };
            setStatus('conflict');
            setMessage(conflict.message);
            return { status: 'conflict', conflict };
          }

          if (res.status === 401 || res.status === 403) {
            // Missing/expired session: distinct signed-out state. Keep the
            // key so a retry after signing in reuses the same intent.
            setStatus('signed_out');
            setMessage(mapped.message);
            return { status: 'signed_out', message: mapped.message };
          }

          setStatus('error');
          setMessage(mapped.message);
          return { status: 'error', message: mapped.message };
        }

        const data = (await res.json().catch(() => ({}))) as Partial<ShopPurchaseResult>;
        const result: ShopPurchaseResult = { orderId: data.orderId, ...payload };
        setStatus('success');
        setMessage('Purchase complete.');
        // Purchase succeeded: this intent is done, so a later purchase of
        // the same SKU/quantity is a new intent and gets a fresh key.
        intentRef.current = null;
        keyRef.current = null;
        return { status: 'success', result };
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError' && !timedOut) {
          // Real cancellation (component teardown / caller's own signal),
          // not a user-facing failure.
          setStatus('idle');
          return { status: 'skipped' };
        }

        // Timeout or network failure: surface an error but KEEP the same
        // idempotency key so a retry of this intent is deduped server-side.
        const errorMessage = timedOut
          ? 'The request took too long. Retry to complete your purchase.'
          : 'Network error. Retry to complete your purchase.';
        setStatus('error');
        setMessage(errorMessage);
        return { status: 'error', message: errorMessage };
      } finally {
        clearTimeout(timer);
        callerSignal?.removeEventListener('abort', onCallerAbort);
        abortRef.current = null;
      }
    },
    [timeoutMs],
  );

  return { status, message, purchase };
}
