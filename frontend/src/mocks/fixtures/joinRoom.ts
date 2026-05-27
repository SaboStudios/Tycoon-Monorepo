import type { GamePlayerResponse } from "@/lib/api/types/dto";

/** NestJS GameException error body — matches backend game-validation.filter output. */
export interface JoinRoomApiError {
  error: string;
  message: string;
  details: Record<string, unknown> | null;
  timestamp: string;
  path: string;
  method: string;
}

export function buildJoinRoomApiError(
  error: string,
  message: string,
  path: string,
  details: Record<string, unknown> | null = null
): JoinRoomApiError {
  return {
    error,
    message,
    details,
    timestamp: new Date().toISOString(),
    path,
    method: "POST",
  };
}

/** Corrected: join success returns GamePlayer (201 Created), not full GameResponse (was 200). */
export function buildJoinRoomSuccessPlayer(
  gameId: number,
  userId: number,
  _code: string
): GamePlayerResponse {
  return {
    id: userId,
    game_id: gameId,
    user_id: userId,
    address: null,
    balance: 1500,
    position: 0,
    turn_order: 1,
    symbol: null,
    chance_jail_card: false,
    community_chest_jail_card: false,
    in_jail: false,
    in_jail_rolls: 0,
    rolls: 0,
    circle: 0,
    turn_count: 0,
    consecutive_timeouts: 0,
    trade_locked_balance: "0.00",
    rolled: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Fixture room codes used by MSW handlers and tests. */
export const JOIN_ROOM_FIXTURE_CODES = {
  success: "ABC123",
  notFound: "NOTFND",
  full: "FULL00",
  unauthorized: "UNAUTH",
  expiredInvite: "EXPIRD",
  alreadyJoined: "JOINED",
} as const;
