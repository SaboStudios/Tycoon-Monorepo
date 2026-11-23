'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  isValidPurchasePayload,
  mapShopPurchaseError,
  readShopPurchaseErrorMessage,
} from '../../lib/api';
import { SHOP_PURCHASES_PATH } from '@/hooks/useShopPurchase';

/**
 * Shop purchase button.
 *
 * Generates a stable Idempotency-Key per purchase intent (SKU + quantity) and
 * reuses it across network retries/reconnects so shop-api can dedupe replays.
 * A new intent (payload change) gets a fresh key. HTTP 409 from shop-api is
 * surfaced as a distinct conflict state rather than a generic error.
 */

export interface PurchaseButtonProps {
  sku: string;
  quantity: number;
  /** Optional price in minor units, for display only. Never trusted for money. */
  priceMinorUnits?: number;
  /**
   * Ticker from the shop payload. Required whenever a price is displayed so the
   * label never falls back to a hardcoded chain ticker (ADR-003: NEAR-only UI).
   */
  currency?: string;
  disabled?: boolean;
  onPurchased?: (result: PurchaseResult) => void;
  onConflict?: (conflict: PurchaseConflict) => void;
}

export interface PurchaseResult {
  orderId?: string;
  sku: string;
  quantity: number;
}

export interface PurchaseConflict {
  sku: string;
  quantity: number;
  message: string;
}

type PurchaseStatus = 'idle' | 'pending' | 'success' | 'conflict' | 'signed_out' | 'error';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Build a stable key for a purchase intent. The key is derived from the
 * payload (SKU + quantity) so retries of the same intent reuse it, while a
 * changed payload produces a different key.
 */
export function buildIdempotencyKey(sku: string, quantity: number): string {
  // Pure function of the intent: no clock, no randomness. Retries of the same
  // SKU + quantity reuse the key; a different payload yields a different key.
  return `shop-purchase:${sku}:${quantity}`;
}

async function postPurchase(
  sku: string,
  quantity: number,
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
    body: JSON.stringify({ sku, quantity }),
    signal,
  });
}

export default function PurchaseButton({
  sku,
  quantity,
  priceMinorUnits,
  currency,
  disabled = false,
  onPurchased,
  onConflict,
}: PurchaseButtonProps) {
  const [status, setStatus] = useState<PurchaseStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Key is scoped to the current intent. It is regenerated whenever the
  // payload (sku/quantity) changes, and reused for retries of that intent.
  const intentRef = useRef<string>(`${sku}:${quantity}`);
  const keyRef = useRef<string>(buildIdempotencyKey(sku, quantity));
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const intent = `${sku}:${quantity}`;
    if (intentRef.current !== intent) {
      intentRef.current = intent;
      keyRef.current = buildIdempotencyKey(sku, quantity);
      setStatus('idle');
      setMessage(null);
    }
  }, [sku, quantity]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const label = useMemo(() => {
    if (status === 'pending') return 'Purchasing…';
    if (status === 'success') return 'Purchased';
    if (status === 'conflict') return 'Retry purchase';
    if (status === 'signed_out') return 'Sign in to purchase';
    return 'Purchase';
  }, [status]);

  const isValidPayload = isValidPurchasePayload({ sku, quantity });

  const handlePurchase = useCallback(async () => {
    if (disabled || status === 'pending' || !isValidPayload) return;

    // Reuse the existing key for retries of the same intent.
    const idempotencyKey = keyRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('pending');
    setMessage(null);

    try {
      const res = await postPurchase(sku, quantity, idempotencyKey, controller.signal);

      // The component may have unmounted (or the intent may have changed)
      // while this request was in flight. A fetch mock/polyfill is not
      // guaranteed to reject just because the signal was aborted, so check
      // explicitly rather than relying only on the AbortError branch below
      // (#2150 — a late response must not call setState or onPurchased for
      // a screen that is gone).
      if (controller.signal.aborted) return;

      if (!res.ok) {
        const mapped = mapShopPurchaseError(
          res.status,
          await readShopPurchaseErrorMessage(res),
        );
        if (mapped.status === 'conflict') {
          // Payload conflict / duplicate intent: distinct UX, not a generic error.
          const conflict: PurchaseConflict = {
            sku,
            quantity,
            message: mapped.message,
          };
          setStatus('conflict');
          setMessage(conflict.message);
          onConflict?.(conflict);
          return;
        }

        if (mapped.status === 'signed_out') {
          // Missing/expired session: distinct signed-out state, not a generic
          // purchase failure. The key is kept for a retry after signing in.
          setStatus('signed_out');
          setMessage(mapped.message);
          return;
        }
      }

      if (!res.ok) {
        const mapped = mapShopPurchaseError(
          res.status,
          await readShopPurchaseErrorMessage(res),
        );
        if (mapped.status === 'conflict') {
          // Payload conflict / duplicate intent: distinct UX, not a generic error.
          const conflict: PurchaseConflict = {
            sku,
            quantity,
            message: mapped.message,
          };
          setStatus('conflict');
          setMessage(conflict.message);
          onConflict?.(conflict);
          return;
        }

        setStatus('error');
        setMessage(mapped.message);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as Partial<PurchaseResult>;
      if (controller.signal.aborted) return;
      setStatus('success');
      setMessage('Purchase complete.');
      onPurchased?.({ orderId: data.orderId, sku, quantity });
    } catch (err) {
      if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') return;
      // Network failure: keep the same key so a retry is deduped server-side.
      setStatus('error');
      setMessage('Network error. Retry to complete your purchase.');
    } finally {
      abortRef.current = null;
    }
  }, [disabled, status, isValidPayload, sku, quantity, onPurchased, onConflict]);

  // The ticker always comes from the shop payload; there is no default, so a
  // missing currency renders the amount without inventing a chain ticker.
  const ticker = typeof currency === 'string' ? currency.trim() : '';
  const priceLabel =
    typeof priceMinorUnits === 'number'
      ? `${(priceMinorUnits / 100).toFixed(2)}${ticker ? ` ${ticker}` : ''}`
      : null;

  return (
    <div className="shop-purchase-button">
      <button
        type="button"
        onClick={handlePurchase}
        disabled={disabled || status === 'pending' || !isValidPayload}
        aria-busy={status === 'pending'}
        data-status={status}
      >
        {label}
        {priceLabel ? (
          <span className="shop-purchase-button__price" data-testid="purchase-price">
            {' '}
            · {priceLabel}
          </span>
        ) : null}
      </button>
      {message ? (
        <p
          role={status === 'conflict' || status === 'error' || status === 'signed_out' ? 'alert' : 'status'}
          className={`shop-purchase-button__message shop-purchase-button__message--${status}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
