"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * useGameSocket
 *
 * Frontend realtime transport hook for Tycoon games (ADR-002).
 *
 * Responsibilities:
 * - Establish an authenticated WS connection (JWT via cookie/header parity with REST).
 * - Track connection state so the UI can render a reconnect banner.
 * - Expose a "resume turn" CTA that reconnects and requests a server-authoritative
 *   snapshot/replay, restoring playability without duplicating actions.
 * - Attach idempotency keys to every outbound intent so reconnect retries are safe.
 * - Surface stable server error codes for illegal actions (seat vs spectator, etc.).
 *
 * The server remains the source of truth for money, dice, inventory, and admin
 * mutations. This hook only submits intents and renders server outcomes.
 */

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type GameSocketErrorCode =
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN_ROLE"
  | "SPECTATOR_CANNOT_ROLL"
  | "ILLEGAL_ACTION"
  | "RATE_LIMITED"
  | "DUPLICATE_ACTION"
  | "INVALID_PAYLOAD"
  | "SERVER_UNAVAILABLE"
  | "UNKNOWN";

export interface GameSocketError {
  code: GameSocketErrorCode;
  message: string;
}

export interface GameSnapshot {
  gameId: string;
  /** Monotonic server sequence; used to detect reordering after reconnect. */
  seq: number;
  /** Server-authoritative state. Hidden cards are never included for spectators. */
  state: unknown;
}

export interface GameSocketOptions {
  gameId: string;
  /** Absolute or relative WS URL. Defaults to NEXT_PUBLIC_GAME_WS_URL. */
  url?: string;
  /** Role hint; server re-authorizes and is authoritative. */
  role?: "seat" | "spectator";
  /** Called when the server pushes a state update. */
  onSnapshot?: (snapshot: GameSnapshot) => void;
  /** Called when the server rejects an action with a stable error code. */
  onError?: (error: GameSocketError) => void;
  /** Called when auth expires mid-session so the UI can prompt re-auth. */
  onAuthExpired?: () => void;
}

export interface GameSocketApi {
  connectionState: ConnectionState;
  lastError: GameSocketError | null;
  /** True when the socket is down and a resume is available. */
  canResume: boolean;
  /** Reconnect + request snapshot/replay. Safe to call repeatedly. */
  resumeTurn: () => void;
  /** Submit an intent. Idempotency key is generated automatically. */
  sendIntent: (type: string, payload?: Record<string, unknown>) => boolean;
}

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 500;

function resolveUrl(explicit?: string): string {
  if (explicit) return explicit;
  const env = process.env.NEXT_PUBLIC_GAME_WS_URL;
  if (env) return env;
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}://${window.location.host}/ws/games`;
  }
  return "";
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeError(raw: unknown): GameSocketError {
  if (raw && typeof raw === "object") {
    const code = (raw as { code?: unknown }).code;
    const message = (raw as { message?: unknown }).message;
    if (typeof code === "string") {
      return {
        code: code as GameSocketErrorCode,
        message: typeof message === "string" ? message : code,
      };
    }
  }
  return { code: "UNKNOWN", message: "Unexpected realtime error" };
}

export function useGameSocket(options: GameSocketOptions): GameSocketApi {
  const { gameId, url, role = "seat", onSnapshot, onError, onAuthExpired } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [lastError, setLastError] = useState<GameSocketError | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualCloseRef = useRef(false);
  const lastSeqRef = useRef(-1);
  const pendingRef = useRef<Map<string, string>>(new Map());

  const callbacksRef = useRef({ onSnapshot, onError, onAuthExpired });
  callbacksRef.current = { onSnapshot, onError, onAuthExpired };

  const resolvedUrl = useMemo(() => resolveUrl(url), [url]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof event.data === "string" ? event.data : "");
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    const msg = parsed as Record<string, unknown>;

    switch (msg.type) {
      case "snapshot": {
        const seq = typeof msg.seq === "number" ? msg.seq : 0;
        // Drop reordered/stale events after reconnect.
        if (seq <= lastSeqRef.current) return;
        lastSeqRef.current = seq;
        callbacksRef.current.onSnapshot?.({
          gameId,
          seq,
          state: msg.state,
        });
        return;
      }
      case "error": {
        const err = normalizeError(msg.error ?? msg);
        setLastError(err);
        if (err.code === "TOKEN_EXPIRED" || err.code === "UNAUTHENTICATED") {
          callbacksRef.current.onAuthExpired?.();
        }
        callbacksRef.current.onError?.(err);
        return;
      }
      case "ack": {
        const key = typeof msg.idempotencyKey === "string" ? msg.idempotencyKey : null;
        if (key) pendingRef.current.delete(key);
        return;
      }
      default:
        return;
    }
  }, [gameId]);

  const connect = useCallback(
    (isResume: boolean) => {
      if (!resolvedUrl) {
        setConnectionState("failed");
        setLastError({ code: "SERVER_UNAVAILABLE", message: "Realtime URL is not configured" });
        return;
      }

      clearTimer();
      manualCloseRef.current = false;
      setConnectionState(isResume ? "reconnecting" : "connecting");

      let socket: WebSocket;
      try {
        socket = new WebSocket(resolvedUrl);
      } catch {
        setConnectionState("failed");
        setLastError({ code: "SERVER_UNAVAILABLE", message: "Unable to open realtime connection" });
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
        setConnectionState("connected");
        setLastError(null);
        // JWT is sent via cookie/header parity with REST; the server re-authorizes
        // the seat vs spectator role and rejects illegal actions with stable codes.
        socket.send(
          JSON.stringify({
            type: "join",
            gameId,
            role,
            resume: isResume,
            sinceSeq: lastSeqRef.current,
          }),
        );
      };

      socket.onmessage = handleMessage;

      socket.onerror = () => {
        setLastError({ code: "SERVER_UNAVAILABLE", message: "Realtime connection error" });
      };

      socket.onclose = () => {
        socketRef.current = null;
        if (manualCloseRef.current) {
          setConnectionState("idle");
          return;
        }
        attemptRef.current += 1;
        const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attemptRef.current - 1), MAX_BACKOFF_MS);
        setConnectionState("reconnecting");
        clearTimer();
        timerRef.current = setTimeout(() => connect(true), delay);
      };
    },
    [clearTimer, gameId, handleMessage, resolvedUrl, role],
  );

  useEffect(() => {
    connect(false);
    return () => {
      manualCloseRef.current = true;
      clearTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect, clearTimer]);

  const resumeTurn = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // Already connected: request a fresh snapshot/replay without duplicating actions.
      socketRef.current.send(
        JSON.stringify({ type: "resume", gameId, sinceSeq: lastSeqRef.current }),
      );
      return;
    }
    attemptRef.current = 0;
    connect(true);
  }, [connect, gameId]);

  const sendIntent = useCallback(
    (type: string, payload: Record<string, unknown> = {}) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setLastError({ code: "SERVER_UNAVAILABLE", message: "Not connected" });
        return false;
      }
      const idempotencyKey = newIdempotencyKey();
      pendingRef.current.set(idempotencyKey, type);
      socket.send(
        JSON.stringify({
          type: "intent",
          action: type,
          gameId,
          role,
          idempotencyKey,
          payload,
        }),
      );
      return true;
    },
    [gameId, role],
  );

  return {
    connectionState,
    lastError,
    canResume: connectionState === "reconnecting" || connectionState === "failed",
    resumeTurn,
    sendIntent,
  };
}

export default useGameSocket;
