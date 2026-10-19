'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * Settings page — danger zone.
 *
 * Implements the danger-zone confirmation flow and a11y requirements from
 * frontend/docs/SW-FE-753-756-route-settings-shop-a11y-typesafety.md:
 *  - explicit confirm step before any destructive action
 *  - focus trap while the confirm dialog is open
 *  - Escape cancels the dialog
 *  - focus returns to the trigger on close
 *  - ARIA labelling (role=dialog, aria-modal, aria-labelledby/describedby)
 *  - loading / empty / error states for the danger-zone actions
 */

type DangerActionId = 'delete-account' | 'reset-progress';

type DangerAction = {
  id: DangerActionId;
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
};

const DANGER_ACTIONS: readonly DangerAction[] = [
  {
    id: 'reset-progress',
    title: 'Reset progress',
    description:
      'Clears your local game progress. This cannot be undone.',
    confirmLabel: 'Reset progress',
    destructive: true,
  },
  {
    id: 'delete-account',
    title: 'Delete account',
    description:
      'Permanently deletes your account and all associated data. This cannot be undone.',
    confirmLabel: 'Delete account',
    destructive: true,
  },
] as const;

type ActionStatus = 'idle' | 'loading' | 'error' | 'success';

type ActionState = {
  status: ActionStatus;
  error: string | null;
};

const IDLE_STATE: ActionState = { status: 'idle', error: null };

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function performDangerAction(id: DangerActionId): Promise<void> {
  const res = await fetch(`/api/settings/danger/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  });

  if (!res.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const body: unknown = await res.json();
      if (
        body !== null &&
        typeof body === 'object' &&
        'message' in body &&
        typeof (body as { message?: unknown }).message === 'string'
      ) {
        message = (body as { message: string }).message;
      }
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message);
  }
}

export default function SettingsPage() {
  const [actions, setActions] = useState<readonly DangerAction[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<DangerActionId | null>(null);
  const [states, setStates] = useState<Record<DangerActionId, ActionState>>({
    'delete-account': IDLE_STATE,
    'reset-progress': IDLE_STATE,
  });

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    // Danger-zone actions are static config; simulate the async load so the
    // loading/empty/error states are exercised and testable.
    Promise.resolve(DANGER_ACTIONS)
      .then((loaded) => {
        if (!cancelled) setActions(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Unable to load danger zone actions.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeDialog = useCallback(() => {
    setPendingId(null);
    // Return focus to the element that opened the dialog.
    triggerRef.current?.focus();
  }, []);

  const openDialog = useCallback(
    (id: DangerActionId, trigger: HTMLButtonElement) => {
      triggerRef.current = trigger;
      setPendingId(id);
    },
    [],
  );

  // Focus trap + Escape handling while the confirm dialog is open.
  useEffect(() => {
    if (pendingId === null) return;

    const dialog = dialogRef.current;
    if (dialog === null) return;

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    const first = focusables[0] ?? dialog;
    const last = focusables[focusables.length - 1] ?? dialog;
    first.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== 'Tab') return;

      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pendingId, closeDialog]);

  const confirmAction = useCallback(async () => {
    if (pendingId === null) return;
    const id = pendingId;
    setStates((prev) => ({ ...prev, [id]: { status: 'loading', error: null } }));
    try {
      await performDangerAction(id);
      setStates((prev) => ({ ...prev, [id]: { status: 'success', error: null } }));
      closeDialog();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setStates((prev) => ({ ...prev, [id]: { status: 'error', error: message } }));
    }
  }, [pendingId, closeDialog]);

  const pendingAction =
    pendingId !== null && actions !== null
      ? actions.find((action) => action.id === pendingId) ?? null
      : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section aria-labelledby="danger-zone-heading" className="mt-8">
        <h2
          id="danger-zone-heading"
          className="text-lg font-semibold text-red-600"
        >
          Danger zone
        </h2>

        {loadError !== null ? (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {loadError}
          </p>
        ) : actions === null ? (
          <p role="status" aria-live="polite" className="mt-4 text-sm text-gray-500">
            Loading danger zone actions…
          </p>
        ) : actions.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No danger zone actions are available.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {actions.map((action) => {
              const state = states[action.id];
              const isBusy = state.status === 'loading';
              return (
                <li
                  key={action.id}
                  className="rounded-lg border border-red-200 p-4"
                >
                  <h3 className="font-medium">{action.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {action.description}
                  </p>
                  <button
                    type="button"
                    className="mt-3 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={isBusy}
                    aria-busy={isBusy}
                    onClick={(event) => openDialog(action.id, event.currentTarget)}
                  >
                    {isBusy ? 'Working…' : action.title}
                  </button>
                  {state.status === 'error' && state.error !== null ? (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                      {state.error}
                    </p>
                  ) : null}
                  {state.status === 'success' ? (
                    <p role="status" className="mt-2 text-sm text-green-700">
                      {action.title} completed.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pendingAction !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 id={titleId} className="text-lg font-semibold">
              Confirm {pendingAction.title.toLowerCase()}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm text-gray-600">
              {pendingAction.description}
            </p>

            {states[pendingAction.id].status === 'error' &&
            states[pendingAction.id].error !== null ? (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {states[pendingAction.id].error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium"
                onClick={closeDialog}
                disabled={states[pendingAction.id].status === 'loading'}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={confirmAction}
                disabled={states[pendingAction.id].status === 'loading'}
                aria-busy={states[pendingAction.id].status === 'loading'}
              >
                {states[pendingAction.id].status === 'loading'
                  ? 'Working…'
                  : pendingAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
