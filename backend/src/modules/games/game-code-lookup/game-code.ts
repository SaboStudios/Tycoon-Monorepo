import { BadRequestException } from '@nestjs/common';

/** Game codes are 6 characters from [A-Z0-9] (see generateGameCode). */
export const GAME_CODE_PATTERN = /^[A-Z0-9]{6}$/;

/** Stable error codes surfaced in the `code` field of error responses. */
export enum GameCodeLookupErrorCode {
  INVALID_GAME_CODE = 'INVALID_GAME_CODE',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
}

export function isValidGameCode(normalized: string): boolean {
  return GAME_CODE_PATTERN.test(normalized);
}

/**
 * Trim + uppercase. Rejects anything that cannot be a game code before it
 * reaches the database; the raw input is never echoed back.
 */
export function normalizeGameCode(raw: unknown): string {
  const normalized = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!isValidGameCode(normalized)) {
    throw new BadRequestException({
      message: 'Game code must be 6 letters or digits.',
      code: GameCodeLookupErrorCode.INVALID_GAME_CODE,
    });
  }
  return normalized;
}
