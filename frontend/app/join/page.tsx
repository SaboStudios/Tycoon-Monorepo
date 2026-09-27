'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Join room page.
 *
 * Strict validation error states per frontend/docs/JOIN_ROOM_IMPLEMENTATION_GUIDE.md:
 * - loading / empty / error states are distinct and player-facing
 * - API 500 (server error) is mapped differently from an empty result
 * - writes fail closed: no navigation on any non-success outcome
 * - adversarial / oversized / malformed room codes are rejected client-side
 * - double CTA clicks are guarded (single in-flight request)
 * - a11y: focus management + aria-live error announcements
 */

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;
const MAX_ROOM_CODE_LENGTH = 12;

// Telemetry is consent-gated and scrubbed of PII. Unknown providers fail closed
// (no-op) rather than shipping an unvetted analytics call.
type TelemetryEvent =
  | 'join_room_submit'
  | 'join_room_success'
  | 'join_room_error';

function track(event: TelemetryEvent, props: Record<string, string | number> = {}) {
  if (typeof window === 'undefined') return;
  const consent = window.localStorage?.getItem('tycoon.telemetry.consent');
  if (consent !== 'granted') return;
  // Scrub: only allow a fixed, non-PII shape. Room codes are never sent.
  const safeProps: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === 'roomCode' || key === 'code') continue;
    safeProps[key] = value;
  }
  const w = window as unknown as {
    tycoonAnalytics?: { track?: (e: string, p: Record<string, string | number>) => void };
  };
  w.tycoonAnalytics?.track?.(event, safeProps);
}

type JoinState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'success'; roomId: string };

interface JoinRoomResponse {
  roomId?: string;
}

export default function JoinRoomPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [state, setState] = useState<JoinState>({ status: 'idle' });
  const inFlightRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Focus management: move focus to the error region when an error appears so
  // screen readers and keyboard users land on the announcement.
  useEffect(() => {
    if (state.status === 'error') {
      errorRef.current?.focus();
    }
  }, [state.status]);

  const validate = useCallback((raw: string): string | null => {
    const code = raw.trim().toUpperCase();
    if (code.length === 0) return 'Enter a room code to continue.';
    if (code.length > MAX_ROOM_CODE_LENGTH) return 'Room codes are at most 12 characters.';
    if (!ROOM_CODE_PATTERN.test(code)) {
      return 'Room codes use only letters and numbers (4–12 characters).';
    }
    return null;
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      // Guard against double CTA clicks / reconnect retries: a single in-flight
      // request is allowed; subsequent submits are ignored until it settles.
      if (inFlightRef.current) return;

      const code = roomCode.trim().toUpperCase();
      const validationError = validate(code);
      if (validationError) {
        setState({ status: 'error', message: validationError });
        return;
      }

      inFlightRef.current = true;
      setState({ status: 'loading' });
      track('join_room_submit');

      try {
        const response = await fetch('/api/rooms/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: code }),
          credentials: 'same-origin',
        });

        // Auth expiry mid-flow: fail closed and route to sign-in.
        if (response.status === 401) {
          setState({ status: 'error', message: 'Your session expired. Please sign in again.' });
          track('join_room_error', { reason: 'auth_expired' });
          return;
        }

        // Forbidden role access: fail closed, no navigation.
        if (response.status === 403) {
          setState({ status: 'error', message: 'You do not have access to this room.' });
          track('join_room_error', { reason: 'forbidden' });
          return;
        }

        // API 500 vs empty: a server error is NOT an empty result.
        if (response.status >= 500) {
          setState({
            status: 'error',
            message: 'Something went wrong on our end. Please try again.',
          });
          track('join_room_error', { reason: 'server_error' });
          return;
        }

        if (response.status === 404) {
          setState({ status: 'empty', message: '' } as JoinState);
          track('join_room_error', { reason: 'not_found' });
          return;
        }

        if (!response.ok) {
          setState({ status: 'error', message: 'Unable to join this room. Please try again.' });
          track('join_room_error', { reason: 'unexpected' });
          return;
        }

        const data = (await response.json()) as JoinRoomResponse;
        if (!data || typeof data.roomId !== 'string' || data.roomId.length === 0) {
          // Empty payload is distinct from a server error.
          setState({ status: 'empty' } as JoinState);
          track('join_room_error', { reason: 'empty' });
          return;
        }

        setState({ status: 'success', roomId: data.roomId });
        track('join_room_success');
        router.push(`/rooms/${encodeURIComponent(data.roomId)}`);
      } catch {
        // Network / wallet reject / dependency outage: fail closed on writes.
        setState({
          status: 'error',
          message: 'Could not reach the server. Check your connection and try again.',
        });
        track('join_room_error', { reason: 'network' });
      } finally {
        inFlightRef.current = false;
      }
    },
    [roomCode, router, validate],
  );

  const isLoading = state.status === 'loading';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Join a room</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <label htmlFor="room-code" className="text-sm font-medium">
          Room code
        </label>
        <input
          id="room-code"
          ref={inputRef}
          name="roomCode"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={MAX_ROOM_CODE_LENGTH}
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          aria-invalid={state.status === 'error'}
          aria-describedby={state.status === 'error' ? 'room-code-error' : undefined}
          disabled={isLoading}
          className="rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
        >
          {isLoading ? 'Joining…' : 'Join room'}
        </button>
      </form>

      {/* aria-live region announces loading / empty / error / success states. */}
      <div aria-live="polite" role="status" className="min-h-[1.5rem] text-sm">
        {state.status === 'loading' && <p>Joining room…</p>}
        {state.status === 'empty' && (
          <p className="text-gray-600">No room found for that code.</p>
        )}
        {state.status === 'success' && <p className="text-green-700">Joined! Redirecting…</p>}
      </div>

      {state.status === 'error' && (
        <p
          id="room-code-error"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="text-sm text-red-600 focus:outline-none"
        >
          {state.message}
        </p>
      )}
    </main>
  );
}
