// SW-4: MSW fixtures for the join-room flow.
// These handlers mirror the real backend API contract so tests stay in parity
// with what the server actually returns (shapes match backend DTOs in
// frontend/src/lib/api/types/dto.ts).

import { http, HttpResponse } from "msw";

const BASE = "http://localhost:3000/api/v1";

export const joinRoomHandlers = [
  // Success: valid 6-char code
  http.post(`${BASE}/games/:code/join`, ({ params }) => {
    const { code } = params as { code: string };
    if (typeof code !== "string" || code.length !== 6) {
      return HttpResponse.json(
        { message: "Invalid room code" },
        { status: 400 }
      );
    }
    return HttpResponse.json(
      {
        id: 1,
        code,
        mode: "PUBLIC" as const,
        status: "PENDING" as const,
        number_of_players: 4,
        creator_id: 99,
        winner_id: null,
        next_player_id: null,
        is_ai: false,
        is_minipay: false,
        chain: null,
        duration: null,
        started_at: null,
        contract_game_id: null,
        placements: null,
        settings: {
          id: 1,
          game_id: 1,
          allow_spectators: true,
          enable_powerups: false,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // 404: room not found
  http.post(`${BASE}/games/NOTFND/join`, () =>
    HttpResponse.json({ message: "Game not found" }, { status: 404 })
  ),

  // 409: room full
  http.post(`${BASE}/games/FULL00/join`, () =>
    HttpResponse.json({ message: "Game is full" }, { status: 409 })
  ),
];
