/**
 * Join-room MSW handlers — parity with API contract (#1261).
 *
 * Verifies that join-room MSW handlers return correct response shapes,
 * status codes, and error details matching the backend GameException structure.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { joinRoomHandlers } from "../src/mocks/joinRoomHandlers";
import {
  JOIN_ROOM_FIXTURE_CODES,
  buildJoinRoomApiError,
  buildJoinRoomSuccessPlayer,
} from "../src/mocks/fixtures/joinRoom";
import type {
  GamePlayerResponse,
  JoinRoomApiError,
} from "../src/lib/api/types/dto";

const server = setupServer(...joinRoomHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const BASE = "http://localhost:3000/api/v1";

describe("SW-FE-015: Join-room MSW handlers — parity with API", () => {
  describe("success: POST /games/ABC123/join", () => {
    it("returns 201 Created with GamePlayerResponse shape", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.success}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as GamePlayerResponse;

      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("game_id");
      expect(body).toHaveProperty("user_id");
      expect(body).toHaveProperty("address");
      expect(body).toHaveProperty("balance");
      expect(body).toHaveProperty("position");
      expect(body).toHaveProperty("turn_order");
      expect(body).toHaveProperty("symbol");
      expect(body).toHaveProperty("in_jail");
      expect(body).toHaveProperty("rolls");
      expect(body).toHaveProperty("created_at");
      expect(body).toHaveProperty("updated_at");
    });

    it("success response contains valid game player data", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.success}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      const body = (await res.json()) as GamePlayerResponse;

      expect(typeof body.id).toBe("number");
      expect(typeof body.user_id).toBe("number");
      expect(typeof body.game_id).toBe("number");
      expect(typeof body.balance).toBe("number");
      expect(body.balance).toBeGreaterThan(0);
      expect(typeof body.in_jail).toBe("boolean");
      expect(body.created_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(body.updated_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it("requires Authorization header", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.success}/join`, {
        method: "POST",
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as JoinRoomApiError;
      expect(body.error).toBe("UNAUTHORIZED");
    });
  });

  describe("error: 409 Conflict — GAME_FULL", () => {
    it("returns 409 with GameException error shape for FULL00", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.full}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as JoinRoomApiError;

      expect(body.error).toBe("GAME_FULL");
      expect(body.message).toContain("full");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("path");
      expect(body).toHaveProperty("method", "POST");
    });

    it("409 response includes details about current and max players", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.full}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      const body = (await res.json()) as JoinRoomApiError;

      expect(body.details).toBeDefined();
      expect(body.details).toHaveProperty("gameId");
      expect(body.details).toHaveProperty("currentPlayers");
      expect(body.details).toHaveProperty("maxPlayers");
      expect(body.details!.currentPlayers).toBe(4);
      expect(body.details!.maxPlayers).toBe(4);
    });
  });

  describe("error: 404 Not Found — GAME_NOT_FOUND", () => {
    it("returns 404 with GameException error shape for NOTFND", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.notFound}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as JoinRoomApiError;

      expect(body.error).toBe("GAME_NOT_FOUND");
      expect(body.message).toContain("not found");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("path");
      expect(body).toHaveProperty("method", "POST");
    });

    it("404 response includes gameId in details", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.notFound}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      const body = (await res.json()) as JoinRoomApiError;

      expect(body.details).toBeDefined();
      expect(body.details).toHaveProperty("gameId");
    });
  });

  describe("error: 409 Conflict — GAME_ALREADY_JOINED", () => {
    it("returns 409 with GAME_ALREADY_JOINED error for JOINED fixture", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.alreadyJoined}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as JoinRoomApiError;

      expect(body.error).toBe("GAME_ALREADY_JOINED");
      expect(body.message).toContain("already joined");
    });

    it("GAME_ALREADY_JOINED details include gameId and userId", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.alreadyJoined}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      const body = (await res.json()) as JoinRoomApiError;

      expect(body.details).toHaveProperty("gameId");
      expect(body.details).toHaveProperty("userId");
    });
  });

  describe("error: 410 Gone — INVITE_EXPIRED", () => {
    it("returns 410 with INVITE_EXPIRED error for EXPIRD fixture", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.expiredInvite}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      expect(res.status).toBe(410);
      const body = (await res.json()) as JoinRoomApiError;

      expect(body.error).toBe("INVITE_EXPIRED");
      expect(body.message).toContain("expired");
    });

    it("INVITE_EXPIRED details explain the reason", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.expiredInvite}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      const body = (await res.json()) as JoinRoomApiError;

      expect(body.details).toBeDefined();
      expect(body.details).toHaveProperty("reason", "expired");
    });
  });

  describe("error: 401 Unauthorized — UNAUTHORIZED", () => {
    it("returns 401 with UNAUTHORIZED error for UNAUTH fixture", async () => {
      const res = await fetch(`${BASE}/games/${JOIN_ROOM_FIXTURE_CODES.unauthorized}/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as JoinRoomApiError;

      expect(body.error).toBe("UNAUTHORIZED");
    });
  });

  describe("error: 400 Bad Request — GAME_VALIDATION_ERROR", () => {
    it("returns 400 for invalid room code format", async () => {
      const res = await fetch(`${BASE}/games/invalid/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as JoinRoomApiError;

      expect(body.error).toBe("GAME_VALIDATION_ERROR");
      expect(body.message).toContain("Invalid");
    });

    it("400 response includes field validation details", async () => {
      const res = await fetch(`${BASE}/games/short/join`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      const body = (await res.json()) as JoinRoomApiError;

      expect(body.details).toBeDefined();
      expect(body.details).toHaveProperty("field", "roomCode");
      expect(body.details).toHaveProperty("constraint");
    });
  });

  describe("fixture codes consistency", () => {
    it("all fixture codes are 6 uppercase alphanumeric characters", () => {
      const codes = Object.values(JOIN_ROOM_FIXTURE_CODES);
      const sixCharCodeRegex = /^[A-Z0-9]{6}$/;

      for (const code of codes) {
        expect(code).toMatch(sixCharCodeRegex);
      }
    });

    it("fixture codes are unique", () => {
      const codes = Object.values(JOIN_ROOM_FIXTURE_CODES);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe("error response structure consistency", () => {
    it("all error responses include required GameException fields", async () => {
      const fixtures = [
        { code: JOIN_ROOM_FIXTURE_CODES.notFound, status: 404 },
        { code: JOIN_ROOM_FIXTURE_CODES.full, status: 409 },
        { code: JOIN_ROOM_FIXTURE_CODES.alreadyJoined, status: 409 },
        { code: JOIN_ROOM_FIXTURE_CODES.expiredInvite, status: 410 },
        { code: JOIN_ROOM_FIXTURE_CODES.unauthorized, status: 401 },
      ];

      for (const fixture of fixtures) {
        const res = await fetch(`${BASE}/games/${fixture.code}/join`, {
          method: "POST",
          headers: { Authorization: "Bearer test-token" },
        });

        expect(res.status).toBe(fixture.status);
        const body = (await res.json()) as JoinRoomApiError;

        expect(body).toHaveProperty("error");
        expect(body).toHaveProperty("message");
        expect(body).toHaveProperty("timestamp");
        expect(body).toHaveProperty("path");
        expect(body).toHaveProperty("method");
        expect(body.method).toBe("POST");
        expect(body.path).toContain(`/games/${fixture.code}/join`);
      }
    });
  });
});
