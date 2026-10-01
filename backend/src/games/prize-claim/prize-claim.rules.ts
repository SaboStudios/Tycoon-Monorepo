/**
 * Prize-claim decision rules. Pure: no I/O, no clock, fully table-testable.
 *
 * Invariants:
 *  1. Only a FINISHED game can be claimed.
 *  2. Only the winner can claim (everyone else is rejected, even if a claim exists).
 *  3. A game has at most one claim. A repeat claim by the winner is a replay (same result), never a second grant.
 *  4. A game with no/zero prize cannot be claimed.
 *  5. The amount always comes from the server's game row, never from the client.
 */
export type ClaimRejectCode = 'GAME_NOT_FINISHED' | 'NOT_WINNER' | 'NO_PRIZE';

export interface ClaimGameView {
  status: string;
  winnerId: string | number | null;
  prizeAmount: string | null; // integer string (minor units)
}
export interface ExistingClaim {
  amount: string;
  claimedAt: Date;
}
export type ClaimDecision =
  | { kind: 'grant'; amount: string }
  | { kind: 'replay'; claim: ExistingClaim }
  | { kind: 'reject'; code: ClaimRejectCode };

export const FINISHED_STATUS = 'FINISHED'; // ⬇ match your GameStatus value

export function decideClaim(input: {
  game: ClaimGameView;
  userId: string | number;
  existing: ExistingClaim | null;
}): ClaimDecision {
  const { game, userId, existing } = input;
  if (game.status !== FINISHED_STATUS) return { kind: 'reject', code: 'GAME_NOT_FINISHED' };
  if (game.winnerId === null || String(game.winnerId) !== String(userId)) {
    return { kind: 'reject', code: 'NOT_WINNER' };
  }
  if (existing) return { kind: 'replay', claim: existing };
  if (!game.prizeAmount || !/^\d+$/.test(game.prizeAmount) || BigInt(game.prizeAmount) <= 0n) {
    return { kind: 'reject', code: 'NO_PRIZE' };
  }
  return { kind: 'grant', amount: game.prizeAmount };
}