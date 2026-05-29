import { type ToastOptions } from 'react-toastify';
import { TycoonApiError } from '@/lib/api/errors';
import type { ApiErrorCode } from '@/lib/api/errors';
import { toastManager } from './toast-manager';

/**
 * Human-readable toast copy keyed by ApiErrorCode.
 *
 * Rules:
 *  - Messages must never expose internal details (stack traces, SQL, tokens).
 *  - Auth errors redirect the user to act; they do not describe the failure.
 *  - Validation errors ask the user to review their input.
 *  - Transient errors (network, timeout, 5xx) invite a retry.
 */
export const API_ERROR_TOAST_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You don\'t have permission to do that.',
  NOT_FOUND: 'The requested resource could not be found.',
  VALIDATION_ERROR: 'Some fields are invalid. Please review your input and try again.',
  CONFLICT: 'This action conflicts with existing data. Please refresh and try again.',
  RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_SERVER_ERROR: 'Something went wrong on our end. Please try again in a moment.',
  NETWORK_ERROR: 'Unable to reach the server. Check your connection and try again.',
  TIMEOUT: 'The request took too long. Please try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

/**
 * Toast options per error code.
 *
 * Auth errors stay visible longer so the user can read and act.
 * Transient errors auto-close quickly since a retry is the natural next step.
 */
const API_ERROR_TOAST_OPTIONS: Partial<Record<ApiErrorCode, Partial<ToastOptions>>> = {
  UNAUTHORIZED: { autoClose: 8000 },
  FORBIDDEN: { autoClose: 8000 },
  RATE_LIMIT: { autoClose: 7000 },
  INTERNAL_SERVER_ERROR: { autoClose: 7000 },
  NETWORK_ERROR: { autoClose: 7000 },
  TIMEOUT: { autoClose: 7000 },
};

/**
 * Show an error toast for any `TycoonApiError`.
 *
 * Picks the right user-facing message and duration from the error code.
 * Falls back to the server's own message only when no mapping exists (should
 * not happen in practice, but guards against future codes).
 *
 * @example
 * ```ts
 * apiClient.post('/games', body).catch((err) => {
 *   toastApiError(err);
 * });
 * ```
 */
export function toastApiError(
  err: unknown,
  overrideOptions?: Partial<ToastOptions>,
): void {
  if (!(err instanceof TycoonApiError)) {
    // Not a typed API error — show a generic fallback.
    toastManager.error(API_ERROR_TOAST_MESSAGES.UNKNOWN, overrideOptions);
    return;
  }

  const message =
    API_ERROR_TOAST_MESSAGES[err.code] ?? API_ERROR_TOAST_MESSAGES.UNKNOWN;

  const codeOptions = API_ERROR_TOAST_OPTIONS[err.code] ?? {};

  toastManager.error(message, { ...codeOptions, ...overrideOptions });
}

/**
 * Resolve the user-facing toast message for a given `ApiErrorCode`.
 *
 * Useful when callers need the message string without immediately showing a
 * toast (e.g. for inline form error display or logging).
 */
export function getApiErrorMessage(code: ApiErrorCode): string {
  return API_ERROR_TOAST_MESSAGES[code] ?? API_ERROR_TOAST_MESSAGES.UNKNOWN;
}
