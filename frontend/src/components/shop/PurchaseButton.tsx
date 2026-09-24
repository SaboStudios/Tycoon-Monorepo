'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

type PurchaseStatus = 'idle' | 'pending' | 'success' | 'conflict' | 'error';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Build a stable key for a purchase intent. The key is derived from the
 * payload (SKU + quantity) so retries of the same intent reuse it, while a
 * changed payload produces a different key.
 */
export function buildIdempotencyKey(sku: string, quantity: number): string {
  const payload = `${sku}:${quantity}`;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    // randomUUID gives us a per-intent nonce; combine with payload so the key
    // is both unique per intent and stable for retries of that intent.
    return `${payload}:${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2);
  const ts = Date.now().toString(36);
  return `${payload}:${ts}-${rand}`;
}

async function postPurchase(
  sku: string,
  quantity: number,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<Response> {
  return fetch('/api/shop/purchases', {
    method: 'POST',
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
  currency = 'XLM',
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
    return 'Purchase';
  }, [status]);

  const handlePurchase = useCallback(async () => {
    if (disabled || status === 'pending') return;

    // Reuse the existing key for retries of the same intent.
    const idempotencyKey = keyRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('pending');
    setMessage(null);

    try {
      const res = await postPurchase(sku, quantity, idempotencyKey, controller.signal);

      if (res.status === 409) {
        // Payload conflict / duplicate intent: distinct UX, not a generic error.
        const conflict: PurchaseConflict = {
          sku,
          quantity,
          message:
            'This purchase conflicts with a previous request. Review your cart and try again.',
        };
        setStatus('conflict');
        setMessage(conflict.message);
        onConflict?.(conflict);
        return;
      }

      if (!res.ok) {
        setStatus('error');
        setMessage('Purchase failed. Please try again.');
        return;
      }

      const data = (await res.json().catch(() => ({}))) as Partial<PurchaseResult>;
      setStatus('success');
      setMessage('Purchase complete.');
      onPurchased?.({ orderId: data.orderId, sku, quantity });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      // Network failure: keep the same key so a retry is deduped server-side.
      setStatus('error');
      setMessage('Network error. Retry to complete your purchase.');
    } finally {
      abortRef.current = null;
    }
  }, [disabled, status, sku, quantity, onPurchased, onConflict]);

  const priceLabel =
    typeof priceMinorUnits === 'number'
      ? `${(priceMinorUnits / 100).toFixed(2)} ${currency}`
      : null;

  return (
    <div className="shop-purchase-button">
      <button
        type="button"
        onClick={handlePurchase}
        disabled={disabled || status === 'pending'}
        aria-busy={status === 'pending'}
        data-status={status}
      >
        {label}
        {priceLabel ? <span className="shop-purchase-button__price"> · {priceLabel}</span> : null}
      </button>
      {message ? (
        <p
          role={status === 'conflict' || status === 'error' ? 'alert' : 'status'}
          className={`shop-purchase-button__message shop-purchase-button__message--${status}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
