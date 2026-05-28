/**
 * Maps a server error response to a Record<fieldName, errorMessage>.
 * Handles NestJS class-validator 400 format:
 *   { message: string[] | string, statusCode: number }
 * and custom field-level errors:
 *   { errors: { field: string; message: string }[] }
 *
 * Tree-shake optimized: only included if mapServerErrors is imported.
 */
export type FieldErrors = Record<string, string>;

interface ServerErrorResponse {
  message?: string | string[];
  errors?: { field: string; message: string }[];
  statusCode?: number;
}

/* @__PURE__ */
const FIELD_KEYWORDS: Record<string, string> = {
  email: "email",
  password: "password",
  address: "address",
  chain: "chain",
  roomCode: "roomCode",
  playerName: "playerName",
  customStake: "customStake",
};

function isServerErrorResponse(v: unknown): v is ServerErrorResponse {
  return typeof v === "object" && v !== null;
}

/**
 * Maps server errors to field-level error messages.
 * Pure function: no side effects, safe for tree-shaking.
 */
export function mapServerErrors(error: unknown): FieldErrors {
  if (!isServerErrorResponse(error)) return { _form: "An unexpected error occurred" };
  const body: ServerErrorResponse = error;
  const result: FieldErrors = {};

  // Explicit field errors array
  if (Array.isArray(body.errors)) {
    for (const e of body.errors) {
      result[e.field] = e.message;
    }
    return result;
  }

  // Status-code shortcut: map well-known codes to actionable messages before
  // attempting keyword extraction, so users never see a raw server string.
  if (body.statusCode === 401 || body.statusCode === 403) {
    return { _form: "Please sign in to join a room." };
  }
  if (body.statusCode === 404) return { _form: "Room not found. Check the code and try again." };
  if (body.statusCode === 409) return { _form: "Room is full. Try a different room." };
  if (body.statusCode === 410) {
    return { _form: "This invite link has expired. Ask the host for a new one." };
  }
  if (typeof body.statusCode === "number" && body.statusCode >= 500) {
    return { _form: "Server error. Please try again in a moment." };
  }

  // NestJS class-validator messages array — infer field from message text
  const raw = body.message;
  const messages: string[] = Array.isArray(raw)
    ? raw.filter((m): m is string => typeof m === "string")
    : typeof raw === "string"
    ? [raw]
    : [];

  for (const msg of messages) {
    const lower = msg.toLowerCase();
    if (lower.includes("already joined") || lower.includes("already in this")) {
      return { _form: "You're already in this room." };
    }
    if (lower.includes("expired") && lower.includes("invite")) {
      return { _form: "This invite link has expired. Ask the host for a new one." };
    }
    if (lower.includes("not found") || lower.includes("game not found")) {
      return { _form: "Room not found. Check the code and try again." };
    }
    if (lower.includes("full")) {
      return { _form: "Room is full. Try a different room." };
    }
    if (lower.includes("unauthorized") || lower.includes("not authenticated")) {
      return { _form: "Please sign in to join a room." };
    }
    for (const [field, keyword] of Object.entries(FIELD_KEYWORDS)) {
      if (lower.includes(keyword)) {
        result[field] = msg;
        break;
      }
    }
    // Fallback: attach to _form if no field matched
    if (Object.keys(result).length === 0) {
      result["_form"] = msg;
    }
  }

  return result;
}
