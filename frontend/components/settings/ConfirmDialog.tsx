'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

/**
 * Settings danger-zone confirmation dialog.
 *
 * Implements SW-FE-753-756 requirements:
 * - Focus trap while open, Escape cancels, focus returns to the trigger on close.
 * - ARIA labelling via aria-labelledby / aria-describedby.
 * - Loading, empty (no description), and error states for the confirm action.
 * - Strict null guards around the async confirm handler and its result.
 */

export type ConfirmDialogState = 'idle' | 'loading' | 'error';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Async confirm handler. Must resolve to `true` to close the dialog.
   * Rejections and `false` results surface the error state without closing.
   */
  onConfirm: () => Promise<boolean> | boolean;
  onCancel: () => void;
  /** Optional error message override; falls back to a generic message. */
  errorMessage?: string | null;
  children?: ReactNode;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const DEFAULT_ERROR = 'Something went wrong. Please try again.';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  errorMessage,
  children,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<ConfirmDialogState>('idle');
  const [error, setError] = useState<string | null>(null);

  const hasDescription = typeof description === 'string' && description.trim().length > 0;

  // Reset transient state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setState('idle');
      setError(null);
    }
  }, [open]);

  // Capture the trigger element and restore focus on close.
  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    return () => {
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [open]);

  // Move initial focus into the dialog once mounted.
  useEffect(() => {
    if (!open) {
      return;
    }
    const node = confirmRef.current ?? dialogRef.current;
    if (node) {
      node.focus();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (state !== 'loading') {
          onCancel();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const container = dialogRef.current;
      if (!container) {
        return;
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    },
    [onCancel, state],
  );

  const handleConfirm = useCallback(async () => {
    if (state === 'loading') {
      return;
    }

    setState('loading');
    setError(null);

    try {
      const result = await onConfirm();
      if (result === true) {
        setState('idle');
        return;
      }
      setState('error');
      setError(errorMessage ?? DEFAULT_ERROR);
    } catch (err) {
      setState('error');
      setError(
        errorMessage ??
          (err instanceof Error && err.message ? err.message : DEFAULT_ERROR),
      );
    }
  }, [errorMessage, onConfirm, state]);

  if (!open) {
    return null;
  }

  const isLoading = state === 'loading';
  const isError = state === 'error';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        tabIndex={-1}
        className="w-full max-w-md rounded-lg bg-slate-900 p-6 text-slate-100 shadow-xl outline-none"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>

        {hasDescription ? (
          <p id={descriptionId} className="mt-2 text-sm text-slate-300">
            {description}
          </p>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        {isError ? (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error ?? DEFAULT_ERROR}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            aria-busy={isLoading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
