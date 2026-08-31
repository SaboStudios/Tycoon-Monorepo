/**
 * Games API — thin client wrappers for the /api/v1/games endpoints.
 *
 * Imported by server components; must NOT contain "use client".
 * Keep this file free of browser-only APIs.
 */

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000") + "/api/v1";

/** Minimal shape returned by GET /games/code/:code */
export interface GameRoomSummary {
  id: number;
  code: string;
  status: string;
  mode: string;
  numberOfPlayers: number;
}

export type RoomLookupResult =
  | { found: true; game: GameRoomSummary }
  | { found: false; reason: "not_found" | "network_error" | "rate_limited" };

/**
 * Verify a game code against the backend.
 *
 * - 200 → found
 * - 404 → not found
 * - 429 → rate-limited (treated as unknown so the UI can retry gracefully)
 * - Network failure → treated as unknown (caller decides how to surface this)
 *
 * Rate-limit friendly: uses a single GET with no retry so the page never
 * hammers the server.  A short AbortSignal timeout protects the waiting-room
 * page SSR from hanging.
 */
export async function fetchGameRoom(
  code: string,
  signal?: AbortSignal,
): Promise<RoomLookupResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  // Merge caller-supplied signal so the page can also abort (e.g. route change)
  const combinedSignal = signal ?? controller.signal;

  try {
    const res = await fetch(`${API_BASE}/games/code/${encodeURIComponent(code)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: combinedSignal,
      // next.js cache: revalidate every 10 s so repeated SSR hits are cheap
      // @ts-expect-error — Next.js extended fetch options
      next: { revalidate: 10 },
    });

    if (res.ok) {
      const game = (await res.json()) as GameRoomSummary;
      return { found: true, game };
    }

    if (res.status === 404) {
      return { found: false, reason: "not_found" };
    }

    if (res.status === 429) {
      return { found: false, reason: "rate_limited" };
    }

    // Other non-ok responses (500, etc.) — treat as network_error
    return { found: false, reason: "network_error" };
  } catch {
    return { found: false, reason: "network_error" };
  } finally {
    clearTimeout(timeoutId);
  }
}
