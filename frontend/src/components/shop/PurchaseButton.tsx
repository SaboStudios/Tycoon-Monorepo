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

    if (outcome.status === 'success') {
      const result: ShopPurchaseResult = outcome.result;
      onPurchased?.({ orderId: result.orderId, sku: result.sku, quantity: result.quantity });
    } else if (outcome.status === 'conflict') {
      onConflict?.(outcome.conflict);
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
