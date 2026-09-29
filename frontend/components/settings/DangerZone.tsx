'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * Settings danger zone with an accessible, keyboard-first confirmation flow.
 *
 * Implements SW-FE-753-756 requirements:
 * - focus trap inside the confirm dialog
 * - Escape cancels the confirm
 * - focus returns to the trigger on close
 * - ARIA labelling via aria-labelledby / aria-describedby
 * - loading / empty / error states for the destructive action
 * - strict null guards around the async confirm flow
 */

export type DangerZoneActionId = 'delete-account' | 'reset-progress';

export interface DangerZoneAction {
  id: DangerZoneActionId;
  title: string;
  description: string;
  confirmLabel: string;
  /** Human-readable consequence shown inside the confirm dialog. */
  consequence: string;
}

export interface DangerZoneProps {
  actions?: DangerZoneAction[];
  /**
   * Performs the destructive action. Must reject on failure so the dialog can
   * surface an error state. Resolving means the action succeeded.
   */
  onConfirm: (id: DangerZoneActionId) => Promise<void>;
  /** Optional initial loading state while actions are fetched. */
  loading?: boolean;
  /** Optional error from the actions fetch. */
  error?: string | null;
}

const DEFAULT_ACTIONS: DangerZoneAction[] = [
  {
    id: 'reset-progress',
    title: 'Reset progress',
    description: 'Clear your local progress and start over from the beginning.',
    confirmLabel: 'Reset progress',
    consequence: 'Your saved progress will be permanently cleared.',
  },
  {
    id: 'delete-account',
    title: 'Delete account',
    description: 'Permanently delete your account and all associated data.',
    confirmLabel: 'Delete account',
    consequence: 'This action cannot be undone. All account data will be erased.',
  },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DangerZone({
  actions = DEFAULT_ACTIONS,
  onConfirm,
  loading = false,
  error = null,
}: DangerZoneProps) {
  const [pendingId, setPendingId] = useState<DangerZoneActionId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const titleId = useId();
  const descriptionId = useId();

  const pendingAction =
    pendingId === null ? null : actions.find((action) => action.id === pendingId) ?? null;

  const closeDialog = useCallback(() => {
    setPendingId(null);
    setSubmitError(null);
    setSubmitting(false);
    // Return focus to the element that opened the dialog.
    triggerRef.current?.focus();
  }, []);

  const handleConfirm = useCallback(async () => {
    if (pendingId === null || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirm(pendingId);
      closeDialog();
    } catch (err) {
      const message =
        err instanceof Error && err.message.length > 0
          ? err.message
          : 'Something went wrong. Please try again.';
      setSubmitError(message);
      setSubmitting(false);
    }
  }, [closeDialog, onConfirm, pendingId, submitting]);

  // Focus trap + Escape handling while the dialog is open.
  useEffect(() => {
    if (pendingAction === null) {
      return;
    }

    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    // Move focus into the dialog on open.
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!submitting) {
          closeDialog();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeDialog, pendingAction, submitting]);

  if (loading) {
    return (
      <section aria-labelledby="danger-zone-heading" className="danger-zone">
        <h2 id="danger-zone-heading">Danger zone</h2>
        <p role="status" aria-live="polite">
          Loading danger zone actions…
        </p>
      </section>
    );
  }

  if (error !== null && error !== undefined) {
    return (
      <section aria-labelledby="danger-zone-heading" className="danger-zone">
        <h2 id="danger-zone-heading">Danger zone</h2>
        <p role="alert">
          We couldn’t load the danger zone actions. {error}
        </p>
      </section>
    );
  }

  if (actions.length === 0) {
    return (
      <section aria-labelledby="danger-zone-heading" className="danger-zone">
        <h2 id="danger-zone-heading">Danger zone</h2>
        <p>No destructive actions are available for this account.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="danger-zone-heading" className="danger-zone">
      <h2 id="danger-zone-heading">Danger zone</h2>
      <ul className="danger-zone__list">
        {actions.map((action) => (
          <li key={action.id} className="danger-zone__item">
            <div>
              <h3>{action.title}</h3>
              <p>{action.description}</p>
            </div>
            <button
              type="button"
              className="danger-zone__trigger"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setSubmitError(null);
                setPendingId(action.id);
              }}
            >
              {action.confirmLabel}
            </button>
          </li>
        ))}
      </ul>

      {pendingAction !== null && (
        <div className="danger-zone__overlay">
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="danger-zone__dialog"
          >
            <h3 id={titleId}>Confirm {pendingAction.title.toLowerCase()}</h3>
            <p id={descriptionId}>{pendingAction.consequence}</p>

            {submitError !== null && (
              <p role="alert" className="danger-zone__error">
                {submitError}
              </p>
            )}

            <div className="danger-zone__actions">
              <button
                ref={cancelRef}
                type="button"
                onClick={closeDialog}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-zone__confirm"
                onClick={handleConfirm}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? 'Working…' : pendingAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default DangerZone;
