'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmText,
  cancelText,
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <Card className="w-full max-w-md border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            {isDangerous && <AlertCircle className="h-5 w-5 text-red-500" />}
            <CardTitle id="modal-title" className="text-[var(--tycoon-text)]">
              {title}
            </CardTitle>
          </div>
          <CardDescription id="modal-description" className="text-[var(--tycoon-text)]/60">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 border-[var(--tycoon-border)] text-[var(--tycoon-text)]"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 ${
              isDangerous
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-[var(--tycoon-accent)] hover:bg-[var(--tycoon-accent)]/90 text-[#010F10]'
            }`}
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
