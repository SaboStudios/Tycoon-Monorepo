import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GamesObservabilityService } from './games-observability.service';
import { GameStatus } from './entities/game.entity';

describe('GamesObservabilityService', () => {
  let service: GamesObservabilityService;
  let configService: ConfigService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesObservabilityService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GamesObservabilityService>(GamesObservabilityService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logGameCreation', () => {
    it('should log game creation with metrics', () => {
      const gameData = {
        id: 1,
        code: 'ABC123',
        mode: 'PUBLIC',
        number_of_players: 4,
        is_ai: false,
        is_minipay: false,
        chain: null,
      };
      const creatorId = 123;
      const duration = 0.5;

      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      const incSpy = jest.spyOn(service['gamesCreatedTotal'], 'inc');
      const observeSpy = jest.spyOn(service['gameOperationsDuration'], 'observe');

      service.logGameCreation(gameData, creatorId, duration);

      expect(incSpy).toHaveBeenCalledWith({
        mode: 'PUBLIC',
        is_ai: 'false',
        is_minipay: 'false',
        chain: 'none',
      });
      expect(observeSpy).toHaveBeenCalledWith({ operation: 'create' }, duration);
      expect(logSpy).toHaveBeenCalledWith('Game created successfully', {
        event: 'game_created',
        game_id: 1,
        game_code: 'ABC123',
        creator_id: 123,
        mode: 'PUBLIC',
        number_of_players: 4,
        is_ai: false,
        is_minipay: false,
        chain: null,
        duration_ms: 500,
      });
    });
  });

  describe('logGameJoin', () => {
    it('should log successful game join', () => {
      const gameId = 1;
      const userId = 123;
      const duration = 0.2;

      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      const incSpy = jest.spyOn(service['gamesJoinedTotal'], 'inc');
      const observeSpy = jest.spyOn(service['gameOperationsDuration'], 'observe');

      service.logGameJoin(gameId, userId, 'success', undefined, duration);

      expect(incSpy).toHaveBeenCalledWith({ result: 'success', reason: 'none' });
      expect(observeSpy).toHaveBeenCalledWith({ operation: 'join' }, duration);
      expect(logSpy).toHaveBeenCalledWith('Game join success', {
        event: 'game_join',
        game_id: 1,
        user_id: 123,
        result: 'success',
        reason: 'none',
        duration_ms: 200,
      });
    });

    it('should log failed game join with warning', () => {
      const gameId = 1;
      const userId = 123;
      const reason = 'game_full';

      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
      const incSpy = jest.spyOn(service['gamesJoinedTotal'], 'inc');

      service.logGameJoin(gameId, userId, 'error', reason);

      expect(incSpy).toHaveBeenCalledWith({ result: 'error', reason: 'game_full' });
      expect(warnSpy).toHaveBeenCalledWith('Game join error', {
        event: 'game_join',
        game_id: 1,
        user_id: 123,
        result: 'error',
        reason: 'game_full',
        duration_ms: undefined,
      });
    });
  });

  describe('logGameUpdate', () => {
    it('should log game update with metrics', () => {
      const gameId = 1;
      const updates = { status: 'RUNNING' };
      const userId = 123;
      const userRole = 'admin';
      const duration = 0.3;

      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      const incSpy = jest.spyOn(service['gamesUpdatedTotal'], 'inc');
      const observeSpy = jest.spyOn(service['gameOperationsDuration'], 'observe');

      service.logGameUpdate(gameId, updates, userId, userRole, duration);

      expect(incSpy).toHaveBeenCalledWith({
        field: 'status',
        status_transition: 'true',
      });
      expect(observeSpy).toHaveBeenCalledWith({ operation: 'update' }, duration);
      expect(logSpy).toHaveBeenCalledWith('Game updated successfully', {
        event: 'game_updated',
        game_id: 1,
        updated_by: 123,
        user_role: 'admin',
        fields_updated: ['status'],
        duration_ms: 300,
      });
    });
  });

  describe('logGameCodeGenerationAttempt', () => {
    it('should log successful code generation', () => {
      const attempts = 2;
      const success = true;

      const incSpy = jest.spyOn(service['gameCodeGenerationAttempts'], 'inc');
      const failSpy = jest.spyOn(service['gameCodeGenerationFailures'], 'inc');
      const debugSpy = jest.spyOn(service['logger'], 'debug').mockImplementation();

      service.logGameCodeGenerationAttempt(attempts, success);

      expect(incSpy).toHaveBeenCalled();
      expect(failSpy).not.toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalledWith('Game code generation attempt', {
        event: 'game_code_generation',
        attempts: 2,
        success: true,
      });
    });

    it('should log failed code generation', () => {
      const attempts = 10;
      const success = false;

      const incSpy = jest.spyOn(service['gameCodeGenerationAttempts'], 'inc');
      const failSpy = jest.spyOn(service['gameCodeGenerationFailures'], 'inc');
      const debugSpy = jest.spyOn(service['logger'], 'debug').mockImplementation();

      service.logGameCodeGenerationAttempt(attempts, success);

      expect(incSpy).toHaveBeenCalled();
      expect(failSpy).toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalledWith('Game code generation attempt', {
        event: 'game_code_generation',
        attempts: 10,
        success: false,
      });
    });
  });

  describe('updateActiveGamesMetrics', () => {
    it('should update active games metrics', () => {
      const gameCounts = {
        [GameStatus.PENDING]: 5,
        [GameStatus.RUNNING]: 3,
        [GameStatus.FINISHED]: 10,
      };
      const totalPlayers = 32;

      const setSpy = jest.spyOn(service['activeGamesGauge'], 'set');
      const playersSetSpy = jest.spyOn(service['playersInGamesGauge'], 'set');
      const debugSpy = jest.spyOn(service['logger'], 'debug').mockImplementation();

      service.updateActiveGamesMetrics(gameCounts, totalPlayers);

      expect(setSpy).toHaveBeenCalledWith({ status: GameStatus.PENDING }, 5);
      expect(setSpy).toHaveBeenCalledWith({ status: GameStatus.RUNNING }, 3);
      expect(setSpy).toHaveBeenCalledWith({ status: GameStatus.FINISHED }, 10);
      expect(playersSetSpy).toHaveBeenCalledWith(32);
      expect(debugSpy).toHaveBeenCalledWith('Updated active games metrics', {
        event: 'games_metrics_updated',
        game_counts: gameCounts,
        total_players: 32,
      });
    });
  });

  describe('logGameSearch', () => {
    it('should log game search operation', () => {
      const filters = { status: 'PENDING', userId: 123 };
      const resultCount = 10;
      const duration = 0.15;

      const debugSpy = jest.spyOn(service['logger'], 'debug').mockImplementation();
      const observeSpy = jest.spyOn(service['gameOperationsDuration'], 'observe');

      service.logGameSearch(filters, resultCount, duration);

      expect(observeSpy).toHaveBeenCalledWith({ operation: 'search' }, duration);
      expect(debugSpy).toHaveBeenCalledWith('Game search performed', {
        event: 'game_search',
        filters,
        result_count: 10,
        duration_ms: 150,
      });
    });
  });

  describe('logGameSettingsUpdate', () => {
    it('should log game settings update', () => {
      const gameId = 1;
      const userId = 123;
      const settingsUpdated = { startingCash: 2000, auction: false };
      const duration = 0.25;

      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      const observeSpy = jest.spyOn(service['gameOperationsDuration'], 'observe');

      service.logGameSettingsUpdate(gameId, userId, settingsUpdated, duration);

      expect(observeSpy).toHaveBeenCalledWith({ operation: 'update_settings' }, duration);
      expect(logSpy).toHaveBeenCalledWith('Game settings updated', {
        event: 'game_settings_updated',
        game_id: 1,
        updated_by: 123,
        settings_updated: ['startingCash', 'auction'],
        duration_ms: 250,
      });
    });
  });

  describe('logGameView', () => {
    it('should log successful game view', () => {
      const gameId = 1;
      const userId = 123;
      const found = true;

      const debugSpy = jest.spyOn(service['logger'], 'debug').mockImplementation();

      service.logGameView(gameId, userId, found);

      expect(debugSpy).toHaveBeenCalledWith('Game view requested', {
        event: 'game_view',
        game_id: 1,
        user_id: 123,
        found: true,
      });
    });

    it('should log game view without game ID', () => {
      const debugSpy = jest.spyOn(service['logger'], 'debug').mockImplementation();

      service.logGameView(undefined, undefined, false);

      expect(debugSpy).toHaveBeenCalledWith('Game view requested', {
        event: 'game_view',
        game_id: undefined,
        user_id: undefined,
        found: false,
      });
    });
  });

  describe('logMatchmakingOperation', () => {
    it('should log matchmaking operation', () => {
      const operation = 'join_game';
      const gameId = 1;
      const userId = 123;
      const metadata = { player_address: '0x123...' };

      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

      service.logMatchmakingOperation(operation, gameId, userId, metadata);

      expect(logSpy).toHaveBeenCalledWith('Matchmaking operation', {
        event: 'matchmaking',
        operation,
        game_id: 1,
        user_id: 123,
        metadata,
      });
    });
  });

  describe('logPerformanceMetric', () => {
    it('should log normal performance metric', () => {
      const operation = 'find_by_id';
      const duration = 0.1;
      const metadata = { game_id: 1 };

      const observeSpy = jest.spyOn(service['gameOperationsDuration'], 'observe');
      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      service.logPerformanceMetric(operation, duration, metadata);

      expect(observeSpy).toHaveBeenCalledWith({ operation }, duration);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should log warning for slow operation', () => {
      const operation = 'slow_operation';
      const duration = 2.5; // > 1 second
      const metadata = { game_id: 1 };

      const observeSpy = jest.spyOn(service['gameOperationsDuration'], 'observe');
      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      service.logPerformanceMetric(operation, duration, metadata);

      expect(observeSpy).toHaveBeenCalledWith({ operation }, duration);
      expect(warnSpy).toHaveBeenCalledWith('Slow game operation detected: slow_operation', {
        event: 'slow_operation',
        operation,
        duration_seconds: 2.5,
        metadata,
      });
    });
  });

  describe('createTraceContext', () => {
    it('should create trace context with all parameters', () => {
      const operation = 'create_game';
      const gameId = 1;
      const userId = 123;

      const result = service.createTraceContext(operation, gameId, userId);

      expect(result).toMatchObject({
        operation: 'create_game',
        game_id: 1,
        user_id: 123,
      });
      expect(result).toHaveProperty('trace_id');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.trace_id).toBe('string');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should create trace context with minimal parameters', () => {
      const operation = 'find_all';

      const result = service.createTraceContext(operation);

      expect(result).toMatchObject({
        operation: 'find_all',
        game_id: undefined,
        user_id: undefined,
      });
      expect(result).toHaveProperty('trace_id');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
