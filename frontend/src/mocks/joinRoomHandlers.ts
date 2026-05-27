// SW-FE-015 / #842: MSW fixtures for the join-room flow.
// These handlers mirror the real backend API contract (GameException errors,
// GamePlayer on join success with 201 Created).
//
// CORRECTED (was out of date):
//  - Success status was 200 with a full GameResponse; API returns 201 + GamePlayer.
//  - Error payloads were `{ message }` only; API returns GameException shape with
//    `error`, `message`, `details`, `timestamp`, `path`, and `method`.
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

function joinPath(code: string): string {
  return `${BASE}/games/${code}/join`;
}

export const joinRoomHandlers = [
  http.post(joinPath(JOIN_ROOM_FIXTURE_CODES.notFound), () =>
    HttpResponse.json(
      buildJoinRoomApiError(
        "GAME_NOT_FOUND",
        "Game with code NOTFND not found",
        joinPath(JOIN_ROOM_FIXTURE_CODES.notFound),
        { gameId: "NOTFND" }
      ),
      { status: 404 }
    )
  ),

  http.post(joinPath(JOIN_ROOM_FIXTURE_CODES.full), () =>
    HttpResponse.json(
      buildJoinRoomApiError(
        "GAME_FULL",
        "Game 1 is full (4/4 players)",
        joinPath(JOIN_ROOM_FIXTURE_CODES.full),
        { gameId: 1, currentPlayers: 4, maxPlayers: 4 }
      ),
      { status: 409 }
    )
  ),

  http.post(joinPath(JOIN_ROOM_FIXTURE_CODES.alreadyJoined), () =>
    HttpResponse.json(
      buildJoinRoomApiError(
        "GAME_ALREADY_JOINED",
        "User 42 has already joined game 1",
        joinPath(JOIN_ROOM_FIXTURE_CODES.alreadyJoined),
        { gameId: 1, userId: 42 }
      ),
      { status: 409 }
    )
  ),

  http.post(joinPath(JOIN_ROOM_FIXTURE_CODES.expiredInvite), () =>
    HttpResponse.json(
      buildJoinRoomApiError(
        "INVITE_EXPIRED",
        "Invite token expired for this room",
        joinPath(JOIN_ROOM_FIXTURE_CODES.expiredInvite),
        { reason: "expired" }
      ),
      { status: 410 }
    )
  ),

  http.post(joinPath(JOIN_ROOM_FIXTURE_CODES.unauthorized), () =>
    HttpResponse.json(
      buildJoinRoomApiError(
        "UNAUTHORIZED",
        "Unauthorized",
        joinPath(JOIN_ROOM_FIXTURE_CODES.unauthorized)
      ),
      { status: 401 }
    )
  ),

  http.post(`${BASE}/games/:code/join`, ({ params, request }) => {
    const { code } = params as { code: string };

    if (!request.headers.get("Authorization")) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "UNAUTHORIZED",
          "Unauthorized",
          `${BASE}/games/${code}/join`
        ),
        { status: 401 }
      );
    }

    if (typeof code !== "string" || code.length !== 6 || !/^[A-Z0-9]+$/.test(code)) {
      return HttpResponse.json(
        buildJoinRoomApiError(
          "GAME_VALIDATION_ERROR",
          "Invalid roomCode: Invalid game code format",
          `${BASE}/games/${code}/join`,
          { field: "roomCode", constraint: "Invalid game code format" }
        ),
        { status: 400 }
      );
    }

    return HttpResponse.json(
      buildJoinRoomSuccessPlayer(1, 42, code),
      { status: 201 }
    );
  }),
];
