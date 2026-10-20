import { GameException, GameNotFoundException, GameFullException, GameStatusTransitionException, mapValidationErrorToGameException } from './game-exceptions';

describe('Game Exceptions', () => {
  describe('GameException', () => {
    it('should create a basic game exception', () => {
      const exception = new GameException('Test error', 'TEST_ERROR', { field: 'value' });
      
      expect(exception.message).toBe('Test error');
      expect(exception.errorCode).toBe('TEST_ERROR');
      expect(exception.details).toEqual({ field: 'value' });
      expect(exception.getStatus()).toBe(400);
    });

    it('should include timestamp in response', () => {
      const exception = new GameException('Test error', 'TEST_ERROR');
      const response = exception.getResponse() as any;
      
      expect(response.timestamp).toBeDefined();
      expect(response.error).toBe('TEST_ERROR');
      expect(response.message).toBe('Test error');
    });
  });

  describe('GameNotFoundException', () => {
    it('should create exception with game ID', () => {
      const exception = new GameNotFoundException(123);
      
      expect(exception.errorCode).toBe('GAME_NOT_FOUND');
      expect(exception.message).toBe('Game with ID 123 not found');
      expect(exception.details).toEqual({ gameId: 123 });
      expect(exception.getStatus()).toBe(404);
    });

    it('should create exception with game code', () => {
      const exception = new GameNotFoundException('ABC123');
      
      expect(exception.errorCode).toBe('GAME_NOT_FOUND');
      expect(exception.message).toBe('Game with code ABC123 not found');
      expect(exception.details).toEqual({ gameId: 'ABC123' });
      expect(exception.getStatus()).toBe(404);
    });
  });

  describe('GameFullException', () => {
    it('should create exception with player counts', () => {
      const exception = new GameFullException(1, 4, 4);
      
      expect(exception.errorCode).toBe('GAME_FULL');
      expect(exception.message).toBe('Game 1 is full (4/4 players)');
      expect(exception.details).toEqual({ gameId: 1, currentPlayers: 4, maxPlayers: 4 });
      expect(exception.getStatus()).toBe(409);
    });
  });

  describe('GameStatusTransitionException', () => {
    it('should create exception with status transition', () => {
      const exception = new GameStatusTransitionException('RUNNING', 'PENDING', 123);
      
      expect(exception.errorCode).toBe('INVALID_STATUS_TRANSITION');
      expect(exception.message).toBe('Invalid game status transition from RUNNING to PENDING');
      expect(exception.details).toEqual({ currentStatus: 'RUNNING', targetStatus: 'PENDING', gameId: 123 });
      expect(exception.getStatus()).toBe(400);
    });
  });

  describe('mapValidationErrorToGameException', () => {
    it('should map enum validation error', () => {
      const errors = [{
        property: 'mode',
        value: 'INVALID',
        constraints: {
          isEnum: 'mode must be either PUBLIC or PRIVATE'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception).toBeInstanceOf(GameException);
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid mode: mode must be either PUBLIC or PRIVATE');
      expect(exception.details).toEqual({
        field: 'mode',
        value: 'INVALID',
        constraint: 'mode must be either PUBLIC or PRIVATE'
      });
    });

    it('should map integer validation error', () => {
      const errors = [{
        property: 'numberOfPlayers',
        value: 'invalid',
        constraints: {
          isInt: 'numberOfPlayers must be an integer'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid numberOfPlayers: Must be an integer');
    });

    it('should map min validation error', () => {
      const errors = [{
        property: 'numberOfPlayers',
        value: 1,
        constraints: {
          min: 'numberOfPlayers must be at least 2'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid numberOfPlayers: Value is too small');
    });

    it('should map max validation error', () => {
      const errors = [{
        property: 'numberOfPlayers',
        value: 9,
        constraints: {
          max: 'numberOfPlayers cannot exceed 8'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid numberOfPlayers: Value is too large');
    });

    it('should map maxLength validation error', () => {
      const errors = [{
        property: 'chain',
        value: 'a'.repeat(51),
        constraints: {
          maxLength: 'chain cannot exceed 50 characters'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid chain: Value is too long');
    });

    it('should map string validation error', () => {
      const errors = [{
        property: 'chain',
        value: 123,
        constraints: {
          isString: 'chain must be a string'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid chain: Must be a string');
    });

    it('should map boolean validation error', () => {
      const errors = [{
        property: 'is_ai',
        value: 'true',
        constraints: {
          isBoolean: 'is_ai must be a boolean'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid is_ai: Must be a boolean');
    });

    it('should map date string validation error', () => {
      const errors = [{
        property: 'startTime',
        value: 'invalid-date',
        constraints: {
          isDateString: 'startTime must be a valid ISO 8601 date string'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid startTime: Must be a valid date string');
    });

    it('should map custom game code validation error', () => {
      const errors = [{
        property: 'code',
        value: 'invalid',
        constraints: {
          isGameCode: 'Game code must be exactly 6 characters containing only uppercase letters and numbers'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid code: Invalid game code format');
    });

    it('should map game status transition validation error', () => {
      const errors = [{
        property: 'status',
        value: 'PENDING',
        constraints: {
          isValidGameStatusTransition: 'Invalid game status transition'
        },
        object: {
          currentStatus: 'RUNNING',
          gameId: 123
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception).toBeInstanceOf(GameStatusTransitionException);
      expect(exception.errorCode).toBe('INVALID_STATUS_TRANSITION');
      expect(exception.message).toBe('Invalid game status transition from RUNNING to PENDING');
    });

    it('should map player count validation error', () => {
      const errors = [{
        property: 'numberOfPlayers',
        value: 1,
        constraints: {
          isValidPlayerCount: 'Number of players must be between 2 and 8'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid numberOfPlayers: Invalid player count');
    });

    it('should map blockchain address validation error', () => {
      const errors = [{
        property: 'address',
        value: 'invalid',
        constraints: {
          isValidBlockchainAddress: 'Invalid blockchain address format'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid address: Invalid blockchain address');
    });

    it('should map contract game ID validation error', () => {
      const errors = [{
        property: 'contract_game_id',
        value: 'invalid',
        constraints: {
          isValidContractGameId: 'Invalid contract game ID format'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid contract_game_id: Invalid contract game ID');
    });

    it('should map game placement validation error', () => {
      const errors = [{
        property: 'placements',
        value: { invalid: 'format' },
        constraints: {
          isValidGamePlacement: 'Invalid game placement format'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid placements: Invalid game placement format');
    });

    it('should handle unknown validation error', () => {
      const errors = [{
        property: 'field',
        value: 'value',
        constraints: {
          unknownConstraint: 'Unknown constraint message'
        }
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid field: Unknown constraint message');
    });

    it('should handle empty errors array', () => {
      const exception = mapValidationErrorToGameException([]);
      
      expect(exception.errorCode).toBe('UNKNOWN_VALIDATION_ERROR');
      expect(exception.message).toBe('Unknown validation error');
    });

    it('should handle error without constraints', () => {
      const errors = [{
        property: 'field',
        value: 'value'
      }];

      const exception = mapValidationErrorToGameException(errors);
      
      expect(exception.errorCode).toBe('GAME_VALIDATION_ERROR');
      expect(exception.message).toBe('Invalid field: Validation failed');
    });
  });
});
