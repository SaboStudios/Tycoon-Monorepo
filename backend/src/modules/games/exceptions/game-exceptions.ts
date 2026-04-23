import { HttpException, HttpStatus } from '@nestjs/common';

export class GameException extends HttpException {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly details?: any,
    httpStatus: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        error: errorCode,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
      httpStatus,
    );
  }
}

export class GameNotFoundException extends GameException {
  constructor(gameId?: number | string, details?: any) {
    const identifier = typeof gameId === 'number' ? `ID ${gameId}` : `code ${gameId}`;
    super(
      `Game with ${identifier} not found`,
      'GAME_NOT_FOUND',
      { gameId, ...details },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class GameAlreadyExistsException extends GameException {
  constructor(gameCode: string, details?: any) {
    super(
      `Game with code ${gameCode} already exists`,
      'GAME_ALREADY_EXISTS',
      { gameCode, ...details },
      HttpStatus.CONFLICT,
    );
  }
}

export class GameFullException extends GameException {
  constructor(gameId: number, currentPlayers: number, maxPlayers: number, details?: any) {
    super(
      `Game ${gameId} is full (${currentPlayers}/${maxPlayers} players)`,
      'GAME_FULL',
      { gameId, currentPlayers, maxPlayers, ...details },
      HttpStatus.CONFLICT,
    );
  }
}

export class GameAlreadyJoinedException extends GameException {
  constructor(gameId: number, userId: number, details?: any) {
    super(
      `User ${userId} has already joined game ${gameId}`,
      'GAME_ALREADY_JOINED',
      { gameId, userId, ...details },
      HttpStatus.CONFLICT,
    );
  }
}

export class GameStatusTransitionException extends GameException {
  constructor(currentStatus: string, targetStatus: string, gameId?: number, details?: any) {
    super(
      `Invalid game status transition from ${currentStatus} to ${targetStatus}`,
      'INVALID_STATUS_TRANSITION',
      { currentStatus, targetStatus, gameId, ...details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class GameNotPendingException extends GameException {
  constructor(gameId: number, currentStatus: string, details?: any) {
    super(
      `Cannot modify game ${gameId}: game is not in PENDING status (current: ${currentStatus})`,
      'GAME_NOT_PENDING',
      { gameId, currentStatus, ...details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class GameUnauthorizedException extends GameException {
  constructor(action: string, gameId: number, userId: number, userRole: string, details?: any) {
    super(
      `User ${userId} (${userRole}) is not authorized to ${action} game ${gameId}`,
      'GAME_UNAUTHORIZED',
      { action, gameId, userId, userRole, ...details },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class GameValidationException extends GameException {
  constructor(field: string, value: any, constraint: string, details?: any) {
    super(
      `Invalid ${field}: ${constraint}`,
      'GAME_VALIDATION_ERROR',
      { field, value, constraint, ...details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class GameCodeGenerationException extends GameException {
  constructor(attempts: number, details?: any) {
    super(
      `Failed to generate unique game code after ${attempts} attempts`,
      'GAME_CODE_GENERATION_FAILED',
      { attempts, ...details },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class GameSettingsException extends GameException {
  constructor(gameId: number, reason: string, details?: any) {
    super(
      `Invalid game settings for game ${gameId}: ${reason}`,
      'GAME_SETTINGS_INVALID',
      { gameId, reason, ...details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class GamePlayerNotFoundException extends GameException {
  constructor(gameId: number, userId: number, details?: any) {
    super(
      `Player ${userId} not found in game ${gameId}`,
      'GAME_PLAYER_NOT_FOUND',
      { gameId, userId, ...details },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class GameInsufficientBalanceException extends GameException {
  constructor(gameId: number, userId: number, balance: number, required: number, details?: any) {
    super(
      `Insufficient balance for player ${userId} in game ${gameId}: ${balance} < ${required}`,
      'INSUFFICIENT_BALANCE',
      { gameId, userId, balance, required, ...details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class GameInvalidMoveException extends GameException {
  constructor(gameId: number, userId: number, move: string, reason: string, details?: any) {
    super(
      `Invalid move ${move} for player ${userId} in game ${gameId}: ${reason}`,
      'INVALID_MOVE',
      { gameId, userId, move, reason, ...details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

// Utility function to map validation errors to GameException
export function mapValidationErrorToGameException(errors: any[]): GameException {
  if (errors.length === 0) {
    return new GameException('Unknown validation error', 'UNKNOWN_VALIDATION_ERROR');
  }

  const firstError = errors[0];
  const constraints = firstError.constraints;
  const property = firstError.property;
  const value = firstError.value;

  // Map common validation errors to specific exceptions
  if (constraints && Object.keys(constraints).length > 0) {
    const constraintKey = Object.keys(constraints)[0];
    const constraintMessage = constraints[constraintKey];

    switch (constraintKey) {
      case 'isEnum':
        return new GameValidationException(property, value, constraintMessage);
      case 'isInt':
        return new GameValidationException(property, value, 'Must be an integer');
      case 'min':
        return new GameValidationException(property, value, 'Value is too small');
      case 'max':
        return new GameValidationException(property, value, 'Value is too large');
      case 'maxLength':
        return new GameValidationException(property, value, 'Value is too long');
      case 'isString':
        return new GameValidationException(property, value, 'Must be a string');
      case 'isBoolean':
        return new GameValidationException(property, value, 'Must be a boolean');
      case 'isDateString':
        return new GameValidationException(property, value, 'Must be a valid date string');
      case 'isGameCode':
        return new GameValidationException(property, value, 'Invalid game code format');
      case 'isValidGameStatusTransition':
        return new GameStatusTransitionException(
          firstError.object?.currentStatus || 'UNKNOWN',
          value,
          firstError.object?.gameId,
        );
      case 'isValidPlayerCount':
        return new GameValidationException(property, value, 'Invalid player count');
      case 'isValidBlockchainAddress':
        return new GameValidationException(property, value, 'Invalid blockchain address');
      case 'isValidContractGameId':
        return new GameValidationException(property, value, 'Invalid contract game ID');
      case 'isValidGamePlacement':
        return new GameValidationException(property, value, 'Invalid game placement format');
      default:
        return new GameValidationException(property, value, constraintMessage);
    }
  }

  return new GameValidationException(property, value, 'Validation failed');
}
