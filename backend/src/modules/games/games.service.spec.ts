import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Game, GameMode, GameStatus } from './entities/game.entity';
import { GameSettings } from './entities/game-settings.entity';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { PaginationService } from '../../common';
import { GetGamesDto } from './dto/get-games.dto';

describe('GamesService', () => {
  let service: GamesService;

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

  const mockPaginationService = {
    paginate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
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
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
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
        settings: {
          auction: true,
          rentInPrison: false,
          mortgage: true,
          evenBuild: true,
          randomizePlayOrder: true,
          startingCash: 1500,
        },
      };
      mockQueryRunner.manager.create.mockReturnValue(mockGame);
      mockQueryRunner.manager.save.mockResolvedValue(mockGame);

      mockQueryRunner.manager.create.mockReturnValueOnce(mockGame);
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockGame);

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
        settings: {
          auction: true,
          rentInPrison: false,
          mortgage: true,
          evenBuild: true,
          randomizePlayOrder: true,
          startingCash: 1500,
        },
      };
      mockQueryRunner.manager.create.mockReturnValue(mockGame);
      mockQueryRunner.manager.save.mockResolvedValue(mockGame);

      mockQueryRunner.manager.create.mockReturnValueOnce(mockGame);
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockGame);

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

      await expect(service.create(dto, creatorId)).rejects.toThrow(
        'Database error',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
    };

    beforeEach(() => {
      mockGameRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);
    });

    it('should build query with all supported filters and paginate', async () => {
      const dto: GetGamesDto = {
        userId: 3,
        status: GameStatus.RUNNING,
        mode: GameMode.PUBLIC,
        isAi: true,
        isMinipay: false,
        chain: 'base',
        activeOnly: true,
        startedOrPending: true,
        page: 2,
        limit: 5,
      };

      const paginatedResult = {
        data: [],
        meta: {
          page: 2,
          limit: 5,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      };

      mockPaginationService.paginate.mockResolvedValue(paginatedResult);

      const result = await service.findAll(dto);

      expect(mockGameRepository.createQueryBuilder).toHaveBeenCalledWith('g');
      expect(qb.andWhere).toHaveBeenCalledWith('g.creator_id = :userId', {
        userId: 3,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.status = :status', {
        status: GameStatus.RUNNING,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.mode = :mode', {
        mode: GameMode.PUBLIC,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.is_ai = :isAi', {
        isAi: true,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.is_minipay = :isMinipay', {
        isMinipay: false,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.chain = :chain', {
        chain: 'base',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.status = :activeStatus', {
        activeStatus: GameStatus.RUNNING,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'g.status IN (:...startedStatuses)',
        {
          startedStatuses: [GameStatus.PENDING, GameStatus.RUNNING],
        },
      );

      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        qb,
        expect.objectContaining({
          page: 2,
          limit: 5,
          sortBy: 'created_at',
          sortOrder: 'DESC',
        }),
        ['code', 'chain'],
      );
      expect(result).toEqual(paginatedResult);
    });

    it('should apply default sorting when not provided', async () => {
      const dto: GetGamesDto = {};
      const paginatedResult = {
        data: [],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockPaginationService.paginate.mockResolvedValue(paginatedResult);

      await service.findAll(dto);

      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        qb,
        expect.objectContaining({
          sortBy: 'created_at',
          sortOrder: 'DESC',
        }),
        ['code', 'chain'],
      );
    });
  });
});
