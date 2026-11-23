'use client';

import { useCallback, useMemo } from 'react';

import { isValidPurchasePayload } from '../../lib/api';
import { useShopPurchase, type ShopPurchaseResult } from '@/hooks/useShopPurchase';

/**
 * Shop purchase button.
 *
 * Delegates the actual purchase (Idempotency-Key, fetch, timeout/abort) to
 * `useShopPurchase` so there is exactly one key generator and one fetch
 * implementation shared across the app. This component only renders the
 * resulting status and forwards outcomes to its callers.
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

export default function PurchaseButton({
  sku,
  quantity,
  priceMinorUnits,
  currency,
  disabled = false,
  onPurchased,
  onConflict,
}: PurchaseButtonProps) {
  const { status, message, purchase } = useShopPurchase();

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

    const outcome = await purchase({ sku, quantity });

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
  }, [disabled, status, isValidPayload, purchase, sku, quantity, onPurchased, onConflict]);

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
            {' · '}
            {priceLabel}
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
