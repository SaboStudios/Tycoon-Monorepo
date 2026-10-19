import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Stable machine-readable error codes for the /games WebSocket namespace.
 * Source of truth: backend/docs/GAMES_MATCHMAKING_RUNBOOK.md (§ Stable error
 * codes). Clients switch on these codes; they never change once shipped.
 */
export enum GameActionErrorCode {
  /** No/invalid JWT on handshake or action. */
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  /** Token expired mid-session; client must refresh and re-handshake. */
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  /** Spectator attempted a seat-only action (e.g. roll). */
  FORBIDDEN_ROLE = 'FORBIDDEN_ROLE',
  /** Action requires a seat the user does not hold. */
  NOT_SEATED = 'NOT_SEATED',
  /** It is not this seat's turn (or the seat already acted this turn). */
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  /** Target game/session does not exist. */
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  /** Game/session already force-ended or completed. */
  GAME_ENDED = 'GAME_ENDED',
  /** User was banned/suspended; socket detached. */
  USER_BANNED = 'USER_BANNED',
  /** Join/roll exceeded the rate limit. */
  RATE_LIMITED = 'RATE_LIMITED',
  /** Idempotency key already processed with a different payload. */
  DUPLICATE_ACTION = 'DUPLICATE_ACTION',
  /** Malformed payload or a client-supplied outcome (never trusted). */
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  /** Dependency outage (Postgres/Redis/shop-api); writes fail closed. */
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
  /** In-game chat is disabled pending a moderation pipeline (ADR-002 §7). */
  CHAT_DISABLED = 'CHAT_DISABLED',
  /** Unexpected server error; correlate with logs via requestId. */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface GameActionErrorOptions {
  message?: string;
  /** Correlation id for observability; never contains tokens or PII. */
  requestId?: string;
}

export class GameActionError extends Error {
  readonly code: GameActionErrorCode;
  readonly requestId?: string;

  constructor(code: GameActionErrorCode, options: GameActionErrorOptions = {}) {
    super(options.message ?? code);
    this.name = 'GameActionError';
    this.code = code;
    this.requestId = options.requestId;
    Object.setPrototypeOf(this, GameActionError.prototype);
  }

  toPayload(): {
    code: GameActionErrorCode;
    message: string;
    requestId?: string;
  } {
    return {
      code: this.code,
      message: this.message,
      ...(this.requestId && { requestId: this.requestId }),
    };
  }
}

/**
 * Map an exception thrown by the shared services onto a stable WS error code
 * so REST-origin errors and WS-origin errors converge on one vocabulary.
 */
export function toGameActionError(err: unknown): GameActionError {
  if (err instanceof GameActionError) {
    return err;
  }

  if (err instanceof HttpException) {
    const status = err.getStatus();
    const body = err.getResponse();
    const bodyCode =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>).code
        : undefined;

    if (
      typeof bodyCode === 'string' &&
      Object.values(GameActionErrorCode).includes(
        bodyCode as GameActionErrorCode,
      )
    ) {
      return new GameActionError(bodyCode as GameActionErrorCode, {
        message: err.message,
      });
    }

    if (err instanceof NotFoundException) {
      return new GameActionError(GameActionErrorCode.GAME_NOT_FOUND, {
        message: err.message,
      });
    }
    if (err instanceof ForbiddenException) {
      return new GameActionError(GameActionErrorCode.FORBIDDEN_ROLE, {
        message: err.message,
      });
    }
    if (err instanceof ConflictException) {
      return new GameActionError(GameActionErrorCode.DUPLICATE_ACTION, {
        message: err.message,
      });
    }
    if (err instanceof BadRequestException) {
      return new GameActionError(GameActionErrorCode.INVALID_PAYLOAD, {
        message: err.message,
      });
    }
    if (status >= 500) {
      return new GameActionError(GameActionErrorCode.DEPENDENCY_UNAVAILABLE, {
        message: 'A dependency is unavailable; the action was not applied.',
      });
    }
  }

  return new GameActionError(GameActionErrorCode.INTERNAL_ERROR, {
    message: 'Internal error',
  });
}
