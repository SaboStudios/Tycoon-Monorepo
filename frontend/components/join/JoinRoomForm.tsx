'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { WALLET_MISSING_MESSAGE } from '../landing/Hero';

/**
 * Join room form with strict validation and explicit error states.
 *
 * Error states are mapped distinctly so the UI never conflates an empty
 * response with a server failure (API 500 vs empty). Writes fail closed:
 * the submit handler refuses to fire when the form is invalid, when a
 * request is already in flight (double CTA clicks / reconnect retries),
 * or when the session has expired mid-flow.
 */

export type JoinRoomErrorCode =
  | 'invalid_code'
  | 'empty'
  | 'not_found'
  | 'forbidden'
  | 'auth_expired'
  | 'wallet_rejected'
  | 'rate_limited'
  | 'server_error'
  | 'network_error';

export interface JoinRoomError {
  code: JoinRoomErrorCode;
  message: string;
}

export interface JoinRoomResult {
  roomId: string;
}

export interface JoinRoomFormProps {
  /** Live API call. Must reject with a JoinRoomError-shaped value on failure. */
  onJoin: (roomCode: string, signal: AbortSignal) => Promise<JoinRoomResult>;
  /** Called after a successful join so the caller can navigate. */
  onJoined?: (result: JoinRoomResult) => void;
  /** Optional initial value, e.g. from a deep link. */
  initialCode?: string;
  /** Disable the form while the wallet/session is not ready. */
  disabled?: boolean;
  /**
   * Sentence shown when `disabled` is true, explaining why. Defaults to the
   * same missing-wallet copy the landing hero uses (#2153), so a signed-out
   * player sees one consistent sentence instead of a bare disabled button.
   */
  disabledReason?: string;
}

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

/**
 * Error codes that typing should clear (#2148). A format error (empty input
 * or a code that doesn't match the pattern) is stale the moment the user
 * edits the field. A session/rate-limit/access error is not caused by the
 * current keystroke and must stay visible until a successful retry or an
 * explicit dismiss — otherwise the user resubmits blind into the same wall.
 */
const CLEARABLE_ON_CHANGE_ERRORS: ReadonlySet<JoinRoomErrorCode> = new Set([
  'empty',
  'invalid_code',
]);

const ERROR_COPY: Record<JoinRoomErrorCode, string> = {
  invalid_code: 'Room codes are 4–12 letters or numbers.',
  empty: 'Enter a room code to continue.',
  not_found: 'No room matches that code. Check it and try again.',
  forbidden: 'You do not have access to this room.',
  auth_expired: 'Your session expired. Reconnect your wallet to continue.',
  wallet_rejected: 'Wallet request was rejected. Approve it to join.',
  rate_limited: 'Too many attempts. Wait a moment and try again.',
  server_error: 'Something went wrong on our side. Please try again.',
  network_error: 'Network unavailable. Check your connection and retry.',
};

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateCode(raw: string): JoinRoomError | null {
  const code = normalizeCode(raw);
  if (code.length === 0) {
    return { code: 'empty', message: ERROR_COPY.empty };
  }
  if (!ROOM_CODE_PATTERN.test(code)) {
    return { code: 'invalid_code', message: ERROR_COPY.invalid_code };
  }
  return null;
}

function isJoinRoomError(value: unknown): value is JoinRoomError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { code?: unknown; message?: unknown };
  return (
    typeof candidate.code === 'string' &&
    candidate.code in ERROR_COPY &&
    typeof candidate.message === 'string'
  );
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/** HTTP statuses that map onto an existing, distinct JoinRoomErrorCode. */
const STATUS_ERROR_CODES: Partial<Record<number, JoinRoomErrorCode>> = {
  401: 'auth_expired',
  403: 'forbidden',
  404: 'not_found',
  429: 'rate_limited',
};

/**
 * Reads an HTTP status off a thrown value. Accepts a fetch `Response`
 * (failed fetch rejects with the response itself in some callers' wrappers)
 * or any Error-like object carrying a numeric `status` field (e.g. ApiError).
 */
function getStatusFromError(error: unknown): number | undefined {
  if (typeof Response !== 'undefined' && error instanceof Response) {
    return error.status;
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/**
 * Maps an HTTP status code onto the matching JoinRoomErrorCode. Returns
 * `null` for a status with no distinct UI treatment, so the caller falls
 * back to the generic server error.
 */
function mapHttpStatusError(status: number): JoinRoomError | null {
  const code = STATUS_ERROR_CODES[status];
  if (!code) return null;
  return { code, message: ERROR_COPY[code] };
}

/**
 * Maps a thrown value to a user-facing error. Returns `null` for an aborted
 * request: a cancelled join is not a failure, so the caller clears the
 * submitting state without surfacing an error.
 */
function mapUnknownError(error: unknown): JoinRoomError | null {
  if (isJoinRoomError(error)) {
    return error;
  }
  if (isAbortError(error)) {
    return null;
  }
  const status = getStatusFromError(error);
  if (typeof status === 'number') {
    const mapped = mapHttpStatusError(status);
    if (mapped) return mapped;
  }
  if (error instanceof TypeError) {
    return { code: 'network_error', message: ERROR_COPY.network_error };
  }
  return { code: 'server_error', message: ERROR_COPY.server_error };
}

export function JoinRoomForm({
  onJoin,
  onJoined,
  initialCode = '',
  disabled = false,
  disabledReason = WALLET_MISSING_MESSAGE,
}: JoinRoomFormProps) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<JoinRoomError | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const inputId = useId();
  const errorId = useId();
  const disabledReasonId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // #2149 — the controlled value is the normalized code, so the field
    // shows uppercase (and no surrounding whitespace) as the user types,
    // matching exactly what submit sends.
    setCode(normalizeCode(event.target.value));
    // #2148 — only a format error is stale after a keystroke. A
    // session/rate-limit/access error stays until a successful retry or an
    // explicit dismiss.
    setError((current) =>
      current && CLEARABLE_ON_CHANGE_ERRORS.has(current.code) ? null : current,
    );
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      // Fail closed: never issue a write while one is already in flight.
      if (inFlightRef.current || disabled) {
        return;
      }

      const validationError = validateCode(code);
      if (validationError) {
        setError(validationError);
        inputRef.current?.focus();
        return;
      }

      const normalized = normalizeCode(code);
      inFlightRef.current = true;
      setStatus('submitting');
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await onJoin(normalized, controller.signal);
        setStatus('success');
        onJoined?.(result);
      } catch (caught) {
        setStatus('idle');
        const mapped = mapUnknownError(caught);
        setError(mapped);
        if (mapped) {
          inputRef.current?.focus();
        }
      } finally {
        inFlightRef.current = false;
        abortRef.current = null;
      }
    },
    [code, disabled, onJoin, onJoined],
  );

  const isSubmitting = status === 'submitting';
  const isDisabled = disabled || isSubmitting;

  return (
    <form
      className="join-room-form"
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isSubmitting}
    >
      {disabled ? (
        <p
          id={disabledReasonId}
          role="status"
          className="join-room-form__disabled-reason"
          data-testid="join-room-disabled-reason"
        >
          {disabledReason}
        </p>
      ) : null}

      <label htmlFor={inputId}>Room code</label>
      <input
        id={inputId}
        ref={inputRef}
        name="roomCode"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        value={code}
        onChange={handleChange}
        disabled={isDisabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, disabled ? disabledReasonId : null]
            .filter((id): id is string => Boolean(id))
            .join(' ') || undefined
        }
        placeholder="ABCD12"
      />

      <button type="submit" disabled={isDisabled}>
        {isSubmitting ? 'Joining…' : 'Join room'}
      </button>

      <p
        id={errorId}
        role="alert"
        aria-live="assertive"
        className="join-room-form__error"
        hidden={!error}
      >
        {error?.message ?? ''}
      </p>
    </form>
  );
}

export default JoinRoomForm;
