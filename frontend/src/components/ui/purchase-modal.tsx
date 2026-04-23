'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardContent,
} from '@/components/ui/card';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemPrice: string;
  itemCurrency: string;
}

export function PurchaseModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemPrice,
  itemCurrency,
}: PurchaseModalProps) {
  const { t } = useTranslation('common');
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, isOpen, onClose);

  // Lock body scroll while open; restore previous value on close / unmount
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
      aria-describedby="purchase-modal-description"
      data-testid="purchase-modal"
    >
      {/* Backdrop — click closes modal */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
        data-testid="purchase-modal-backdrop"
      />

      <div ref={containerRef} className="relative z-10 w-full max-w-md">
        <Card className="border-neutral-800 bg-neutral-900 shadow-2xl">
          <CardHeader className="relative">
            {/* ① Close (×) — first in tab order */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('shop.close_modal', { defaultValue: 'Close' })}
              className="absolute right-4 top-4 rounded-sm text-neutral-400 opacity-70 ring-offset-neutral-900 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
              data-testid="purchase-modal-close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <CardTitle id="purchase-modal-title" className="text-xl text-white">
              {t('shop.confirm_purchase', { defaultValue: 'Confirm Purchase' })}
            </CardTitle>
            <CardDescription
              id="purchase-modal-description"
              className="text-neutral-400"
            >
              {t('shop.purchase_confirmation_msg', {
                name: itemName,
                defaultValue: `Are you sure you want to purchase ${itemName}?`,
              })}
            </CardDescription>
          </CardHeader>

          <CardContent className="py-6 text-center">
            <div
              className="text-3xl font-bold text-cyan-400"
              aria-live="polite"
              aria-atomic="true"
              data-testid="purchase-modal-price"
            >
              {itemPrice} {itemCurrency}
            </div>
          </CardContent>

          {/* ② Cancel  ③ Confirm */}
          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              data-testid="purchase-modal-cancel"
            >
              {t('shop.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              className="bg-cyan-500 text-black hover:bg-cyan-400"
              data-testid="purchase-modal-confirm"
            >
              {t('shop.purchase', { defaultValue: 'Purchase' })}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
