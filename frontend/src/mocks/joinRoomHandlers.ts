// SW-FE-015 / #842: MSW fixtures for the join-room flow.
// These handlers mirror the real backend API contract (GameException errors,
// GamePlayer on join success with 201 Created).
//
// Real backend contract (games controller):
//   GET  /games/code/:code  -> Game       (resolve a 6-char room code to a numeric game id)
//   POST /games/:id/join    -> GamePlayer (201) | GameException (404/409/410/401)
//
// IMPORTANT: Specific handlers (NOTFND, FULL00, …) MUST be listed before the
// generic wildcard handler, otherwise MSW will match the generic first.

import { http, HttpResponse } from "msw";
import {
  JOIN_ROOM_FIXTURE_CODES,
  buildJoinRoomApiError,
  buildJoinRoomSuccessPlayer,
} from "@/mocks/fixtures/joinRoom";

const BASE = "http://localhost:3000/api/v1";

/** Numeric game ids assigned to fixture codes so the resolve-then-join flow is stable. */
const FIXTURE_GAME_IDS: Record<string, number> = {
  [JOIN_ROOM_FIXTURE_CODES.full]: 9001,
  [JOIN_ROOM_FIXTURE_CODES.unauthorized]: 9002,
  [JOIN_ROOM_FIXTURE_CODES.expiredInvite]: 9003,
  [JOIN_ROOM_FIXTURE_CODES.alreadyJoined]: 9004,
};

function gamePath(code: string): string {
  return `${BASE}/games/code/${code}`;
}

function joinPath(id: number | string): string {
  return `${BASE}/games/${id}/join`;
}

/** Deterministic game id for a room code (fixed ids for fixtures, hash otherwise). */
function codeToGameId(code: string): number {
  const fixtureId = FIXTURE_GAME_IDS[code];
  if (fixtureId) return fixtureId;
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) % 100000;
  }
  return hash + 10000;
}

export const joinRoomHandlers = [
  // GET /games/code/:code -> resolve a room code to a numeric game id.
  http.get(`${BASE}/games/code/:code`, ({ params }) => {
    const { code } = params as { code: string };

    if (code === JOIN_ROOM_FIXTURE_CODES.notFound) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "GAME_NOT_FOUND",
          `Game with code ${code} not found`,
          gamePath(code),
          { gameId: code }
        ),
        { status: 404 }
      );
    }

    if (typeof code !== "string" || code.length !== 6 || !/^[A-Z0-9]+$/.test(code)) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "GAME_VALIDATION_ERROR",
          "Invalid roomCode: Invalid game code format",
          gamePath(code),
          { field: "roomCode", constraint: "Invalid game code format" }
        ),
        { status: 400 }
      );
    }

    return HttpResponse.json({
      id: codeToGameId(code),
      code,
      mode: "PUBLIC",
      status: "PENDING",
      settings: {
        allow_spectators: true,
        enable_powerups: true,
        ranked: false,
        auction: true,
        rent_in_prison: false,
        mortgage: true,
        even_build: true,
        randomize_play_order: true,
        starting_cash: 1500,
        max_players: 4,
      },
      players: [],
    });
  }),

  // POST /games/:id/join -> GamePlayer (201) on success.
  http.post(`${BASE}/games/:id/join`, ({ params, request }) => {
    const { id } = params as { id: string };

    if (!request.headers.get("Authorization")) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "UNAUTHORIZED",
          "Unauthorized",
          joinPath(id)
        ),
        { status: 401 }
      );
    }

    const gameId = Number(id);

    if (!Number.isInteger(gameId) || gameId <= 0) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "GAME_VALIDATION_ERROR",
          "Invalid game id: Validation failed (numeric string is expected)",
          joinPath(id),
          { field: "id", constraint: "Validation failed (numeric string is expected)" }
        ),
        { status: 400 }
      );
    }

    if (gameId === FIXTURE_GAME_IDS[JOIN_ROOM_FIXTURE_CODES.full]) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "GAME_FULL",
          `Game ${gameId} is full (4/4 players)`,
          joinPath(gameId),
          { gameId, currentPlayers: 4, maxPlayers: 4 }
        ),
        { status: 409 }
      );
    }

    if (gameId === FIXTURE_GAME_IDS[JOIN_ROOM_FIXTURE_CODES.alreadyJoined]) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "GAME_ALREADY_JOINED",
          `User 42 has already joined game ${gameId}`,
          joinPath(gameId),
          { gameId, userId: 42 }
        ),
        { status: 409 }
      );
    }

    if (gameId === FIXTURE_GAME_IDS[JOIN_ROOM_FIXTURE_CODES.expiredInvite]) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "INVITE_EXPIRED",
          "Invite token expired for this room",
          joinPath(gameId),
          { reason: "expired" }
        ),
        { status: 410 }
      );
    }

    if (gameId === FIXTURE_GAME_IDS[JOIN_ROOM_FIXTURE_CODES.unauthorized]) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "UNAUTHORIZED",
          "Unauthorized",
          joinPath(gameId)
        ),
        { status: 401 }
      );
    }

    return HttpResponse.json(
      buildJoinRoomSuccessPlayer(gameId, 42, String(gameId)),
      { status: 201 }
    );
  }),
];

