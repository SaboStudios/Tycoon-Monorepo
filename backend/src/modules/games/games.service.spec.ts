import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Game, GameMode, GameStatus } from './entities/game.entity';
import { GameSettings } from './entities/game-settings.entity';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';

describe('GamesService', () => {
  let service: GamesService;
  let gameRepository: Repository<Game>;
  let gameSettingsRepository: Repository<GameSettings>;
  let dataSource: DataSource;

  const mockGameRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockGameSettingsRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
        {
          provide: getRepositoryToken(GameSettings),
          useValue: mockGameSettingsRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    gameRepository = module.get<Repository<Game>>(getRepositoryToken(Game));
    gameSettingsRepository = module.get<Repository<GameSettings>>(
      getRepositoryToken(GameSettings),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a game with relations when found', async () => {
      const mockGame = {
        id: 1,
        code: 'ABC123',
        mode: GameMode.PUBLIC,
        status: GameStatus.PENDING,
        creator: { id: 1, email: 'user@example.com', username: 'player1' },
        winner: null,
        nextPlayer: null,
      };

      mockGameRepository.findOne.mockResolvedValue(mockGame);

      const result = await service.findById(1);

      expect(mockGameRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['creator', 'winner', 'nextPlayer'],
      });
      expect(result).toEqual(mockGame);
    });

    it('should throw NotFoundException when game not found', async () => {
      mockGameRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(999)).rejects.toThrow(
        'Game with ID 999 not found',
      );
    });
  });

  describe('findByCode', () => {
    it('should return a game with relations when found', async () => {
      const mockGame = {
        id: 1,
        code: 'ABC123',
        mode: GameMode.PUBLIC,
        status: GameStatus.PENDING,
        creator: { id: 1, email: 'user@example.com', username: 'player1' },
        winner: null,
        nextPlayer: null,
      };

      mockGameRepository.findOne.mockResolvedValue(mockGame);

      const result = await service.findByCode('abc123');

      expect(mockGameRepository.findOne).toHaveBeenCalledWith({
        where: { code: 'ABC123' },
        relations: ['creator', 'winner', 'nextPlayer'],
      });
      expect(result).toEqual(mockGame);
    });

    it('should throw NotFoundException when game not found', async () => {
      mockGameRepository.findOne.mockResolvedValue(null);

      await expect(service.findByCode('NOTFOUND')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByCode('NOTFOUND')).rejects.toThrow(
        'Game with code NOTFOUND not found',
      );
    });

    it('should convert code to uppercase before searching', async () => {
      const mockGame = {
        id: 1,
        code: 'ABC123',
        mode: GameMode.PUBLIC,
        status: GameStatus.PENDING,
        creator: { id: 1, email: 'user@example.com' },
        winner: null,
        nextPlayer: null,
      };

      mockGameRepository.findOne.mockResolvedValue(mockGame);

      await service.findByCode('abc123');

      expect(mockGameRepository.findOne).toHaveBeenCalledWith({
        where: { code: 'ABC123' },
        relations: ['creator', 'winner', 'nextPlayer'],
      });
    });
  });

  describe('create', () => {
    it('should create a game with default settings', async () => {
      const dto: CreateGameDto = {
        mode: GameMode.PUBLIC,
        numberOfPlayers: 4,
      };
      const creatorId = 1;

      // Mock unique code check
      mockGameRepository.findOne.mockResolvedValue(null);

      // Mock game creation
      const mockGame = {
        id: 1,
        code: 'ABC123',
        mode: GameMode.PUBLIC,
        number_of_players: 4,
        creator_id: creatorId,
        status: GameStatus.PENDING,
        is_ai: false,
        is_minipay: false,
        chain: null,
        contract_game_id: null,
        created_at: new Date(),
      };
      mockQueryRunner.manager.create.mockReturnValue(mockGame);
      mockQueryRunner.manager.save.mockResolvedValue(mockGame);

      // Mock settings creation
      const mockSettings = {
        game_id: 1,
        auction: true,
        rentInPrison: false,
        mortgage: true,
        evenBuild: true,
        randomizePlayOrder: true,
        startingCash: 1500,
      };
      mockQueryRunner.manager.create.mockReturnValueOnce(mockGame);
      mockQueryRunner.manager.create.mockReturnValueOnce(mockSettings);
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockGame);
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockSettings);

      const result = await service.create(dto, creatorId);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('code');
      expect(result.mode).toBe(GameMode.PUBLIC);
      expect(result.number_of_players).toBe(4);
      expect(result.creator_id).toBe(creatorId);
      expect(result.is_ai).toBe(false);
      expect(result.is_minipay).toBe(false);
    });

    it('should create a game with AI and MiniPay flags', async () => {
      const dto: CreateGameDto = {
        mode: GameMode.PRIVATE,
        numberOfPlayers: 2,
        is_ai: true,
        is_minipay: true,
        chain: 'ethereum',
        contract_game_id: '0x123abc',
      };
      const creatorId = 2;

      mockGameRepository.findOne.mockResolvedValue(null);

      const mockGame = {
        id: 2,
        code: 'XYZ789',
        mode: GameMode.PRIVATE,
        number_of_players: 2,
        creator_id: creatorId,
        status: GameStatus.PENDING,
        is_ai: true,
        is_minipay: true,
        chain: 'ethereum',
        contract_game_id: '0x123abc',
        created_at: new Date(),
      };
      mockQueryRunner.manager.create.mockReturnValue(mockGame);
      mockQueryRunner.manager.save.mockResolvedValue(mockGame);

      const mockSettings = {
        game_id: 2,
        auction: true,
        rentInPrison: false,
        mortgage: true,
        evenBuild: true,
        randomizePlayOrder: true,
        startingCash: 1500,
      };
      mockQueryRunner.manager.create.mockReturnValueOnce(mockGame);
      mockQueryRunner.manager.create.mockReturnValueOnce(mockSettings);
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockGame);
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockSettings);

      const result = await service.create(dto, creatorId);

      expect(result.is_ai).toBe(true);
      expect(result.is_minipay).toBe(true);
      expect(result.chain).toBe('ethereum');
      expect(result.contract_game_id).toBe('0x123abc');
    });

    it('should rollback transaction on error', async () => {
      const dto: CreateGameDto = {
        mode: GameMode.PUBLIC,
        numberOfPlayers: 4,
      };
      const creatorId = 1;

      mockGameRepository.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.create(dto, creatorId)).rejects.toThrow('Database error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
