import { http, HttpResponse } from 'msw';

/**
 * Known-good game codes for local dev / Playwright fixtures.
 * Keep in sync with frontend/src/mocks/fixtures/games.ts
 */
const VALID_GAME_CODES: Record<string, object> = {
  ABC123: {
    id: 1,
    code: 'ABC123',
    status: 'PENDING',
    mode: 'PUBLIC',
    numberOfPlayers: 4,
    creator: { id: 1, username: 'player1' },
  },
  XYZ789: {
    id: 2,
    code: 'XYZ789',
    status: 'PENDING',
    mode: 'PUBLIC',
    numberOfPlayers: 2,
    creator: { id: 2, username: 'player2' },
  },
  GAME01: {
    id: 3,
    code: 'GAME01',
    status: 'PENDING',
    mode: 'PRIVATE',
    numberOfPlayers: 4,
    creator: { id: 3, username: 'player3' },
  },
};

export const gamesHandlers = [
  // GET /api/v1/games/code/:code — used by GameWaitingPage backend validation
  http.get('*/api/v1/games/code/:code', ({ params }) => {
    const code = String(params.code).toUpperCase();
    const game = VALID_GAME_CODES[code];

    if (!game) {
      return HttpResponse.json(
        { message: 'Game not found', code: 'NOT_FOUND', statusCode: 404 },
        { status: 404 },
      );
    }

    return HttpResponse.json(game, { status: 200 });
  }),
];
