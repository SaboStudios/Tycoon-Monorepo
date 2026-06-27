/**
 * Maps server error responses to field-level error messages.
 *
 * Handles multiple error formats:
 * - TycoonApiError with details field (field-level validation errors)
 * - NestJS class-validator 400 format: { message: string[] | string, statusCode: number }
 * - Custom field-level errors: { errors: { field: string; message: string }[] }
 * - Plain error objects with statusCode and message
 *
 * Returns a Record<fieldName, errorMessage> where "_form" is used for form-level errors.
 */
export type FieldErrors = Record<string, string>;

interface ServerErrorResponse {
  message?: string | string[];
  errors?: { field: string; message: string }[];
  statusCode?: number;
  details?: Record<string, string[]>;
  code?: string;
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
 * Extract field-level errors from TycoonApiError details field.
 * Details is a Record<fieldName, string[]> where each field maps to an array of error messages.
 * We take the first message for each field.
 */
function extractDetailsErrors(details: unknown): FieldErrors | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;

  const result: FieldErrors = {};
  let hasErrors = false;

  for (const [field, messages] of Object.entries(details)) {
    if (Array.isArray(messages) && messages.length > 0) {
      const firstMessage = messages.find((m): m is string => typeof m === "string");
      if (firstMessage) {
        result[field] = firstMessage;
        hasErrors = true;
      }
    }
  }

  return hasErrors ? result : null;
}

export function mapServerErrors(error: unknown): FieldErrors {
  if (!isServerErrorResponse(error)) return { _form: "An unexpected error occurred" };
  const body: ServerErrorResponse = error;
  const result: FieldErrors = {};

  // Priority 1: Extract field-level errors from TycoonApiError details field
  // This handles VALIDATION_ERROR responses with structured field errors
  const detailsErrors = extractDetailsErrors(body.details);
  if (detailsErrors) {
    return detailsErrors;
  }

  // Priority 2: Explicit field errors array (custom format)
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    for (const e of body.errors) {
      result[e.field] = e.message;
    }
    return result;
  }

  // Priority 3: Status-code shortcuts for well-known HTTP errors
  // Map status codes to actionable messages before attempting keyword extraction,
  // so users never see raw server strings.
  if (body.statusCode === 401 || body.statusCode === 403) {
    return { _form: "Please sign in to join a room." };
  }
  if (body.statusCode === 404) return { _form: "Room not found. Check the code and try again." };
  if (body.statusCode === 409) {
    const conflictMessage = formatMessages(body.message).find(
      (msg) =>
        msg.toLowerCase().includes("already joined") ||
        msg.toLowerCase().includes("already in this"),
    );
    if (conflictMessage) {
      return { _form: "You're already in this room." };
    }
    return { _form: "Room is full. Try a different room." };
  }
  if (body.statusCode === 410) {
    return { _form: "This invite link has expired. Ask the host for a new one." };
  }
  if (typeof body.statusCode === "number" && body.statusCode >= 500) {
    return { _form: "Server error. Please try again in a moment." };
  }

  // Priority 4: NestJS class-validator messages array
  // Infer field from message text using keyword matching
  const messages = formatMessages(body.message);

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
    let matchedField = false;
    for (const [field, keyword] of Object.entries(FIELD_KEYWORDS)) {
      if (lower.includes(keyword.toLowerCase())) {
        result[field] = msg;
        matchedField = true;
        break;
      }
    }
    // Fallback: attach to _form if no field matched
    if (!matchedField && !result["_form"]) {
      result["_form"] = msg;
    }
  }

  if (Object.keys(result).length === 0) {
    return { _form: "An unexpected error occurred" };
  }

  return result;
}

function formatMessages(raw: string | string[] | undefined): string[] {
  return Array.isArray(raw)
    ? raw.filter((m): m is string => typeof m === "string")
    : typeof raw === "string"
      ? [raw]
      : [];
}
