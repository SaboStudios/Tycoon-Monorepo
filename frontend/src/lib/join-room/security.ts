/**
 * Security utilities for the Join Room flow (#841).
 */

import { isApiError } from "@/lib/api/errors";
import type { FieldErrors } from "@/lib/validation";
import { JOIN_ROOM_I18N } from "@/lib/join-room/i18n-keys";

/** JWT-shaped bearer tokens and long opaque secrets. */
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g;
const SESSION_RE = /\b(session[_-]?id|token|bearer)[=:]\s*\S+/gi;

interface JoinRoomErrorBody {
  message?: string | string[];
  statusCode?: number;
}

export function sanitiseRoomCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
}

export function sanitiseInviteToken(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}

export function sanitiseDisplayName(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s'.-]/gu, "")
    .trim()
    .slice(0, 32);
}

export function sanitizeJoinRoomErrorMessage(msg: string, maxLen = 200): string {
  let safe = msg.replace(JWT_RE, "[redacted]").replace(SESSION_RE, "[redacted]");
  if (safe.length > maxLen) safe = safe.slice(0, maxLen) + "…";
  return safe;
}

export function hasJoinAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("access_token");
  return typeof token === "string" && token.trim().length > 0;
}

function toJoinRoomErrorBody(error: unknown): JoinRoomErrorBody {
  if (isApiError(error)) {
    return { statusCode: error.statusCode, message: error.message };
  }
  if (typeof error === "object" && error !== null) {
    const body = error as JoinRoomErrorBody;
    if ("statusCode" in body || "message" in body) {
      return body;
    }
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return {};
}

function messageText(body: JoinRoomErrorBody): string {
  const raw = body.message;
  if (Array.isArray(raw)) {
    return raw.filter((m): m is string => typeof m === "string").join(" ");
  }
  return typeof raw === "string" ? raw : "";
}

function mapJoinRoomErrorKeys(body: JoinRoomErrorBody): FieldErrors {
  if (body.statusCode === 401 || body.statusCode === 403) {
    return { _form: JOIN_ROOM_I18N.errors.unauthorized };
  }
  if (body.statusCode === 404) {
    return { _form: JOIN_ROOM_I18N.errors.notFound };
  }
  if (body.statusCode === 409) {
    return { _form: JOIN_ROOM_I18N.errors.roomFull };
  }
  if (body.statusCode === 410) {
    return { _form: JOIN_ROOM_I18N.errors.inviteExpired };
  }
  if (typeof body.statusCode === "number" && body.statusCode >= 500) {
    return { _form: JOIN_ROOM_I18N.errors.serverError };
  }

  const lower = messageText(body).toLowerCase();
  if (lower.includes("already joined") || lower.includes("already in this")) {
    return { _form: JOIN_ROOM_I18N.errors.alreadyJoined };
  }
  if (lower.includes("expired") && lower.includes("invite")) {
    return { _form: JOIN_ROOM_I18N.errors.inviteExpired };
  }
  if (lower.includes("not found") || lower.includes("game not found")) {
    return { _form: JOIN_ROOM_I18N.errors.notFound };
  }
  if (lower.includes("full")) {
    return { _form: JOIN_ROOM_I18N.errors.roomFull };
  }
  if (lower.includes("unauthorized") || lower.includes("not authenticated")) {
    return { _form: JOIN_ROOM_I18N.errors.unauthorized };
  }

  return { _form: JOIN_ROOM_I18N.errors.unexpected };
}

/**
 * Maps API/validation errors to join-room i18n keys (no raw server strings).
 */
export function mapJoinRoomErrors(error: unknown): FieldErrors {
  return mapJoinRoomErrorKeys(toJoinRoomErrorBody(error));
}
