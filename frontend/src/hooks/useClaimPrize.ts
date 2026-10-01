'use client';
import { useCallback, useRef, useState } from 'react';

export type ClaimState =
  | { phase: 'idle' }
  | { phase: 'claiming' }
  | { phase: 'claimed'; amount: string; replay: boolean }   // values come from the server only
  | { phase: 'error'; code: 'forbidden' | 'not_finished' | 'not_found' | 'rate_limited' | 'unavailable'; retryable: boolean };

/**
 * Invariants:
 *  - One idempotency key per (modal mount, game); retries REUSE it, so a lost response can never double-claim.
 *  - Only one request in flight (ref guard, so double-click in the same tick is safe).
 *  - UI shows the server's amount/result; nothing is computed locally.
 *  - "already claimed" is a success state, not an error.
 */
export function useClaimPrize(gameId: number) {
  const [state, setState] = useState<ClaimState>({ phase: 'idle' });
  const keyRef = useRef<string>(crypto.randomUUID());
  const inFlight = useRef(false);

  const claim = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ phase: 'claiming' });
    try {
      const res = await fetch(`/api/games/${gameId}/prize-claim`, {   // ⬇ use your API base/client
        method: 'POST',
        credentials: 'include',
        headers: { 'Idempotency-Key': keyRef.current },
      });
      if (res.ok) {
        const body = await res.json();
        setState({ phase: 'claimed', amount: String(body.amount), replay: body.status === 'already_claimed' });
      } else if (res.status === 403) setState({ phase: 'error', code: 'forbidden', retryable: false });
      else if (res.status === 409) setState({ phase: 'error', code: 'not_finished', retryable: false });
      else if (res.status === 404) setState({ phase: 'error', code: 'not_found', retryable: false });
      else if (res.status === 429) setState({ phase: 'error', code: 'rate_limited', retryable: true });
      else setState({ phase: 'error', code: 'unavailable', retryable: true });
    } catch {
      setState({ phase: 'error', code: 'unavailable', retryable: true }); // same key on retry
    } finally {
      inFlight.current = false;
    }
  }, [gameId]);

  return { state, claim };
}