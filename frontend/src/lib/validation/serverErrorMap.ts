/**
 * Maps a server error response to a Record<fieldName, errorMessage>.
 * Handles NestJS class-validator 400 format:
 *   { message: string[] | string, statusCode: number }
 * and custom field-level errors:
 *   { errors: { field: string; message: string }[] }
 */
export type FieldErrors = Record<string, string>;

interface ServerErrorResponse {
  message?: string | string[];
  errors?: { field: string; message: string }[];
  statusCode?: number;
}

const FIELD_KEYWORDS: Record<string, string> = {
  email: "email",
  password: "password",
  address: "address",
  chain: "chain",
  roomCode: "roomCode",
  playerName: "playerName",
  customStake: "customStake",
};

export function mapServerErrors(error: unknown): FieldErrors {
  const body = error as ServerErrorResponse;
  const result: FieldErrors = {};

  // Explicit field errors array
  if (Array.isArray(body?.errors)) {
    for (const e of body.errors) {
      result[e.field] = e.message;
    }
    return result;
  }

  // NestJS class-validator messages array — infer field from message text
  const messages = Array.isArray(body?.message)
    ? body.message
    : typeof body?.message === "string"
    ? [body.message]
    : [];

  for (const msg of messages) {
    const lower = msg.toLowerCase();
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
