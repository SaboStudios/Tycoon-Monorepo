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
  itemName?: string | null;
  itemPrice?: string | null;
  itemCurrency?: string | null;
  isLoading?: boolean;
  error?: string | null;
}

/** Strip HTML tags and trim to prevent XSS via prop injection. */
function sanitizeText(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

export function PurchaseModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemPrice,
  itemCurrency,
  isLoading = false,
  error = null,
}: PurchaseModalProps) {
  const { t } = useTranslation("common");
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, isOpen, onClose);

  // Lock body scroll while open; restore on close/unmount
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Sanitize user-supplied strings before rendering
  const safeName = sanitizeText(itemName || "");
  const safePrice = sanitizeText(itemPrice || "");
  const safeCurrency = sanitizeText(itemCurrency || "");

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="purchase-modal-loading">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-neutral-400 text-sm">
            {t("shop.loading_details", { defaultValue: "Loading item details..." })}
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4" data-testid="purchase-modal-error">
          <div className="text-red-500 text-sm font-medium">{error}</div>
          <Button
            onClick={onClose}
            variant="outline"
            className="mt-2 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            {t("common.close", { defaultValue: "Close" })}
          </Button>
        </div>
      );
    }

    if (!itemName) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4" data-testid="purchase-modal-empty">
          <p className="text-neutral-400 text-sm">
            {t("shop.item_not_found", { defaultValue: "Item details not found." })}
          </p>
        </div>
      );
    }

    return (
      <>
        <CardContent className="py-6 text-center">
          <div
            className="text-3xl font-bold text-cyan-400"
            aria-live="polite"
            aria-atomic="true"
            data-testid="purchase-modal-price"
          >
            {safePrice} {safeCurrency}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button
            data-testid="purchase-modal-cancel"
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            {t("shop.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            data-testid="purchase-modal-confirm"
            type="button"
            onClick={onConfirm}
            className="bg-cyan-500 text-black hover:bg-cyan-400"
          >
            {t("shop.purchase", { defaultValue: "Purchase" })}
          </Button>
        </CardFooter>
      </>
    );
  };

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

      <div ref={containerRef} className="relative z-10 w-full max-w-md px-4">
        <Card className="min-h-[220px] border-neutral-800 bg-neutral-900 shadow-2xl">
          <CardHeader className="relative">
            <button
              type="button"
              onClick={onClose}
              aria-label={t("shop.close_modal", { defaultValue: "Close" })}
              className="absolute right-4 top-4 rounded-sm text-neutral-400 opacity-70 ring-offset-neutral-900 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
              data-testid="purchase-modal-close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <CardTitle id="purchase-modal-title" className="text-xl text-white">
              {t("shop.confirm_purchase", { defaultValue: "Confirm Purchase" })}
            </CardTitle>
            {!isLoading && !error && itemName && (
              <CardDescription id="purchase-modal-description" className="text-neutral-400 mt-2">
                {t("shop.purchase_confirmation_msg", {
                  name: safeName,
                  defaultValue: `Are you sure you want to purchase ${safeName}?`,
                })}
              </CardDescription>
            )}
          </CardHeader>

          {renderContent()}
        </Card>
      </div>
    </div>
  );
}
