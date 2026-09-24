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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
      aria-describedby="purchase-modal-description"
    >
      {/* Backdrop click closes modal */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div ref={containerRef} className="relative z-10 w-full max-w-md">
        <Card className="border-neutral-800 bg-neutral-900 shadow-2xl">
          <CardHeader>
            <CardTitle id="purchase-modal-title" className="text-xl text-white">
              {t('shop.confirm_purchase')}
            </CardTitle>
            <CardDescription id="purchase-modal-description" className="text-neutral-400">
              {t('shop.purchase_confirmation_msg', { name: itemName })}
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6 text-center">
            <div className="text-3xl font-bold text-cyan-400">
              {itemPrice} {itemCurrency}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              {t('shop.cancel')}
            </Button>
            <Button
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
