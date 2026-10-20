import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { EnhancedCreateGameDto } from '../dto/enhanced-create-game.dto';
import { EnhancedUpdateGameDto } from '../dto/enhanced-update-game.dto';
import { EnhancedJoinGameDto } from '../dto/enhanced-join-game.dto';
import { GameMode, GameStatus } from '../entities/game.entity';

describe('Game Validators', () => {
  describe('EnhancedCreateGameDto', () => {
    it('should validate a valid create game DTO', async () => {
      const dto = plainToClass(EnhancedCreateGameDto, {
        mode: GameMode.PUBLIC,
        numberOfPlayers: 4,
        settings: {
          auction: true,
          rentInPrison: false,
          mortgage: true,
          evenBuild: true,
          randomizePlayOrder: true,
          startingCash: 1500,
        },
        is_ai: false,
        is_minipay: false,
        chain: 'ethereum',
        contract_game_id: '0x123abc',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid mode', async () => {
      const dto = plainToClass(EnhancedCreateGameDto, {
        mode: 'INVALID',
        numberOfPlayers: 4,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should reject invalid player count', async () => {
      const dto = plainToClass(EnhancedCreateGameDto, {
        mode: GameMode.PUBLIC,
        numberOfPlayers: 1, // Too few
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidPlayerCount');
    });

    it('should reject player count too high', async () => {
      const dto = plainToClass(EnhancedCreateGameDto, {
        mode: GameMode.PUBLIC,
        numberOfPlayers: 9, // Too many
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidPlayerCount');
    });

    it('should reject invalid contract game ID', async () => {
      const dto = plainToClass(EnhancedCreateGameDto, {
        mode: GameMode.PUBLIC,
        numberOfPlayers: 4,
        contract_game_id: 'invalid-id',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidContractGameId');
    });

    it('should require mode field', async () => {
      const dto = plainToClass(EnhancedCreateGameDto, {
        numberOfPlayers: 4,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should require numberOfPlayers field', async () => {
      const dto = plainToClass(EnhancedCreateGameDto, {
        mode: GameMode.PUBLIC,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });

  describe('EnhancedUpdateGameDto', () => {
    it('should validate a valid update game DTO', async () => {
      const dto = plainToClass(EnhancedUpdateGameDto, {
        status: GameStatus.RUNNING,
        nextPlayerId: 2,
        winnerId: 1,
        placements: { 1: 2, 2: 1 },
        contract_game_id: '0x123abc',
        startTime: '2024-01-15T10:30:00.000Z',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid status', async () => {
      const dto = plainToClass(EnhancedUpdateGameDto, {
        status: 'INVALID_STATUS',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should reject invalid placements', async () => {
      const dto = plainToClass(EnhancedUpdateGameDto, {
        placements: { 'invalid': 1 }, // Non-numeric player ID
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidGamePlacement');
    });

    it('should reject duplicate placement ranks', async () => {
      const dto = plainToClass(EnhancedUpdateGameDto, {
        placements: { 1: 1, 2: 1 }, // Duplicate rank
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidGamePlacement');
    });

    it('should reject negative placement ranks', async () => {
      const dto = plainToClass(EnhancedUpdateGameDto, {
        placements: { 1: -1 }, // Negative rank
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidGamePlacement');
    });

    it('should reject invalid date string', async () => {
      const dto = plainToClass(EnhancedUpdateGameDto, {
        startTime: 'invalid-date',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isDateString');
    });

    it('should reject negative nextPlayerId', async () => {
      const dto = plainToClass(EnhancedUpdateGameDto, {
        nextPlayerId: -1,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should reject negative winnerId', async () => {
      const dto = plainToClass(EnhancedUpdateGameDto, {
        winnerId: 0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });
  });

  describe('EnhancedJoinGameDto', () => {
    it('should validate a valid join game DTO', async () => {
      const dto = plainToClass(EnhancedJoinGameDto, {
        address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate empty DTO (all fields optional)', async () => {
      const dto = plainToClass(EnhancedJoinGameDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid blockchain address', async () => {
      const dto = plainToClass(EnhancedJoinGameDto, {
        address: 'invalid-address',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidBlockchainAddress');
    });

    it('should reject address too short', async () => {
      const dto = plainToClass(EnhancedJoinGameDto, {
        address: '0x123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidBlockchainAddress');
    });

    it('should reject address without 0x prefix', async () => {
      const dto = plainToClass(EnhancedJoinGameDto, {
        address: '742d35Cc6634C0532925a3b8D4C9db96C4b4Db45',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidBlockchainAddress');
    });

    it('should reject empty address string', async () => {
      const dto = plainToClass(EnhancedJoinGameDto, {
        address: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });
});
