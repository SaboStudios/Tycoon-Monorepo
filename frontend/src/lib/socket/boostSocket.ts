/**
 * Socket.IO client for the backend "boosts" namespace (PerkBoostGateway).
 *
 * - The JWT is passed through the socket handshake `auth` payload so it is
 *   never exposed in the connection URL/query string.
 * - Reconnection uses exponential backoff (socket.io defaults, tuned below).
 * - Gated behind the NEXT_PUBLIC_ENABLE_BOOSTS_SOCKET feature flag
 *   (defaults to enabled; see frontend/.env.example).
 */

import { io, type Socket } from "socket.io-client";

export const BOOSTS_NAMESPACE = "/boosts";

export const PERK_BOOST_EVENTS = {
  activated: "boost.activated",
  expired: "boost.expired",
} as const;

/** Feature flag controlling the live perks/boosts socket. Defaults to enabled. */
export function isBoostSocketEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_ENABLE_BOOSTS_SOCKET ?? "true") !== "false";
}

/** Origin of the Nest backend serving the socket.io endpoint. */
export function getBoostSocketUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (explicit) return explicit;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return `${apiUrl.replace(/\/+$/, "")}${BOOSTS_NAMESPACE}`;
}

/** Access token for the JWT handshake (canonical camelCase key, legacy fallback). */
export function getBoostSocketToken(): string | null {
  if (typeof window === "undefined") return null;
  let token = localStorage.getItem("accessToken");
  if (!token) token = localStorage.getItem("access_token");
  return token && token.trim().length > 0 ? token : null;
}

export interface BoostSocketHandlers {
  onBoostActivated?: (data: unknown) => void;
  onBoostExpired?: (data: unknown) => void;
}

/**
 * Create a socket.io client for the perk-boosts namespace.
 * Passes the JWT in the handshake auth payload and stops reconnecting
 * when the server rejects the token (auth failure / 401).
 */
export function createBoostSocket(
  token: string,
  handlers: BoostSocketHandlers = {},
): Socket {
  const socket = io(getBoostSocketUrl(), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
    randomizationFactor: 0.5,
    timeout: 10_000,
  });

  if (handlers.onBoostActivated) {
    socket.on(PERK_BOOST_EVENTS.activated, handlers.onBoostActivated);
  }
  if (handlers.onBoostExpired) {
    socket.on(PERK_BOOST_EVENTS.expired, handlers.onBoostExpired);
  }

  socket.on("connect_error", (err) => {
    const message = (err?.message ?? "").toLowerCase();
    const statusCode = (err as { data?: { statusCode?: number } })?.data?.statusCode;
    if (
      statusCode === 401 ||
      message.includes("unauthorized") ||
      message.includes("invalid token") ||
      message.includes("authentication")
    ) {
      // Auth failure: stop retrying so we don't hammer the server with a bad token.
      socket.disconnect();
    }
  });

  return socket;
}
