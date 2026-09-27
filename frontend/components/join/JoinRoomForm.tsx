'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

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
}

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

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

function validateCode(raw: string): JoinRoomError | null {
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

function mapUnknownError(error: unknown): JoinRoomError {
  if (isJoinRoomError(error)) {
    return error;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { code: 'network_error', message: ERROR_COPY.network_error };
  }
  return { code: 'server_error', message: ERROR_COPY.server_error };
}

export function JoinRoomForm({
  onJoin,
  onJoined,
  initialCode = '',
  disabled = false,
}: JoinRoomFormProps) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<JoinRoomError | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCode(event.target.value);
    setError((current) => (current ? null : current));
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
        setError(mapUnknownError(caught));
        inputRef.current?.focus();
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
        aria-describedby={error ? errorId : undefined}
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
