'use client';

import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

/** Strip HTML tags and trim to prevent XSS via prop injection. */
function sanitizeText(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
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

  if (!isOpen) return null;

  // SW-FE-031: sanitize user-supplied strings before rendering
  const safeName = sanitizeText(itemName);
  const safePrice = sanitizeText(itemPrice);
  const safeCurrency = sanitizeText(itemCurrency);

  return (
    <div
      data-testid="purchase-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
      aria-describedby="purchase-modal-description"
    >
      {/* Backdrop click closes modal */}
      <div
        data-testid="purchase-modal-backdrop"
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/*
        SW-FE-028: explicit min-h prevents CLS when modal content loads.
        The card has a fixed minimum height so the overlay never reflows.
      */}
      <div ref={containerRef} className="relative z-10 w-full max-w-md">
        <Card className="min-h-[220px] border-neutral-800 bg-neutral-900 shadow-2xl">
          <CardHeader>
            <CardTitle id="purchase-modal-title" className="text-xl text-white">
              {t('shop.confirm_purchase')}
            </CardTitle>
            <CardDescription id="purchase-modal-description" className="text-neutral-400">
              {t('shop.purchase_confirmation_msg', { name: safeName })}
            </CardDescription>
          </CardHeader>
          <CardContent data-testid="purchase-modal-price" className="py-6 text-center">
            {/* SW-FE-028: explicit h-10 reserves space for the price line → no CLS */}
            <div className="flex h-10 items-center justify-center text-3xl font-bold text-cyan-400">
              {safePrice} {safeCurrency}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button
              data-testid="purchase-modal-cancel"
              variant="outline"
              onClick={onClose}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              {t('shop.cancel')}
            </Button>
            <Button
              data-testid="purchase-modal-confirm"
              onClick={onConfirm}
              className="bg-cyan-500 text-black hover:bg-cyan-400"
            >
              {t('shop.purchase')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
