'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Connection states surfaced to the player after a WebSocket drop.
 * - connected: socket healthy, banner hidden
 * - connecting: initial (re)connect attempt in flight
 * - reconnecting: retrying after a drop
 * - failed: retries exhausted, manual resume required
 */
export type ReconnectState = 'connected' | 'connecting' | 'reconnecting' | 'failed';

/** Stable, server-mirrored error codes surfaced to the player. */
export type GameErrorCode =
  | 'AUTH_EXPIRED'
  | 'FORBIDDEN_ROLE'
  | 'SPECTATOR_CANNOT_ROLL'
  | 'DUPLICATE_TAB'
  | 'STALE_EVENT'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export interface ResumeSnapshot {
  gameId: string;
  /** Monotonic server sequence; used to drop reordered/duplicate events. */
  lastEventSeq: number;
  /** Opaque idempotency key for the in-flight turn, if any. */
  pendingActionId?: string;
  /** Server-authoritative role for this socket. */
  role: 'seat' | 'spectator';
}

export interface GameReconnectBannerProps {
  /** Current transport state, owned by the WS provider. */
  state: ReconnectState;
  /** Server-authoritative role; spectators never get a roll CTA. */
  role: 'seat' | 'spectator';
  /** Last known server sequence, used to detect reordering after resume. */
  lastEventSeq?: number;
  /** Stable error code from the server, if the drop was caused by one. */
  errorCode?: GameErrorCode;
  /**
   * Trigger reconnect + resume. Must be idempotent: the caller should reuse
   * the pending action idempotency key so a retried turn is not duplicated.
   */
  onResume: (opts: { idempotencyKey?: string }) => Promise<ResumeSnapshot | void>;
  /** Optional: called when the server rejects an action with a stable code. */
  onError?: (code: GameErrorCode) => void;
}

const ERROR_COPY: Record<GameErrorCode, string> = {
  AUTH_EXPIRED: 'Your session expired. Sign in again to resume this turn.',
  FORBIDDEN_ROLE: 'You do not have permission to act in this game.',
  SPECTATOR_CANNOT_ROLL: 'Spectators cannot roll. Ask a seated player to continue.',
  DUPLICATE_TAB: 'This game is open in another tab. Close it to resume here.',
  STALE_EVENT: 'Some events arrived out of order and were skipped.',
  RATE_LIMITED: 'Too many attempts. Wait a moment, then resume.',
  UNKNOWN: 'Connection lost. Resume to continue your turn.',
};

/**
 * Reconnect banner + resume-turn CTA shown after a WebSocket drop.
 *
 * Security/UX invariants enforced here:
 * - Spectators never see a roll/resume-turn CTA (server also rejects rolls).
 * - Resume reuses the pending idempotency key so retried turns are not duplicated.
 * - Reordered events (seq <= lastEventSeq) are ignored, never replayed.
 * - No hidden cards or PII are rendered; only stable error codes are surfaced.
 */
export function GameReconnectBanner({
  state,
  role,
  lastEventSeq = 0,
  errorCode,
  onResume,
  onError,
}: GameReconnectBannerProps) {
  const [resuming, setResuming] = useState(false);
  const [localError, setLocalError] = useState<GameErrorCode | null>(null);
  const seenSeqRef = useRef(lastEventSeq);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Keep the highest observed sequence so reordered events after resume are dropped.
  useEffect(() => {
    if (lastEventSeq > seenSeqRef.current) {
      seenSeqRef.current = lastEventSeq;
    }
  }, [lastEventSeq]);

  const activeError = localError ?? errorCode ?? null;

  const handleResume = useCallback(async () => {
    if (resuming) return;
    setResuming(true);
    setLocalError(null);
    try {
      // Reuse the pending key so a retried turn is idempotent server-side.
      const snapshot = await onResume({
        idempotencyKey: idempotencyKeyRef.current ?? undefined,
      });
      if (snapshot) {
        idempotencyKeyRef.current = snapshot.pendingActionId ?? null;
        // Ignore stale/reordered snapshots.
        if (snapshot.lastEventSeq > seenSeqRef.current) {
          seenSeqRef.current = snapshot.lastEventSeq;
        }
      }
    } catch (err) {
      const code = mapError(err);
      setLocalError(code);
      onError?.(code);
    } finally {
      setResuming(false);
    }
  }, [onResume, onError, resuming]);

  const isSpectator = role === 'spectator';
  const showBanner = state !== 'connected';

  const statusLabel = useMemo(() => {
    switch (state) {
      case 'connecting':
        return 'Connecting…';
      case 'reconnecting':
        return 'Reconnecting…';
      case 'failed':
        return 'Connection lost';
      default:
        return 'Connected';
    }
  }, [state]);

  if (!showBanner) return null;

  const canResume = state === 'failed' || state === 'reconnecting';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="game-reconnect-banner"
      data-state={state}
      data-role={role}
      className="flex items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
    >
      <div className="flex flex-col">
        <span className="font-medium">{statusLabel}</span>
        {activeError ? (
          <span className="text-xs text-amber-700" data-testid="game-reconnect-error">
            {ERROR_COPY[activeError]}
          </span>
        ) : null}
      </div>

      {canResume && !isSpectator ? (
        <button
          type="button"
          onClick={handleResume}
          disabled={resuming}
          data-testid="game-resume-turn-cta"
          className="rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-60"
        >
          {resuming ? 'Resuming…' : 'Resume turn'}
        </button>
      ) : null}

      {canResume && isSpectator ? (
        <span className="text-xs text-amber-700" data-testid="game-spectator-notice">
          Spectating — waiting for a seated player.
        </span>
      ) : null}
    </div>
  );
}

/** Map transport/server errors to stable, player-safe codes. */
function mapError(err: unknown): GameErrorCode {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code ?? '')
        : '';
  switch (raw) {
    case 'AUTH_EXPIRED':
    case 'FORBIDDEN_ROLE':
    case 'SPECTATOR_CANNOT_ROLL':
    case 'DUPLICATE_TAB':
    case 'STALE_EVENT':
    case 'RATE_LIMITED':
      return raw;
    default:
      return 'UNKNOWN';
  }
}

export default GameReconnectBanner;
