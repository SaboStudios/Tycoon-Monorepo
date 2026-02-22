import { Test, TestingModule } from '@nestjs/testing';
import { GamePlayersService } from './game-players.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Game, GameStatus } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaginationService } from '../../common/services/pagination.service';

describe('GamePlayersService', () => {
  let service: GamePlayersService;
  let gamePlayerRepository: Repository<GamePlayer>;
  let gameRepository: Repository<Game>;

  const mockGamePlayerRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
  };

  const mockGameRepository = {
    findOne: jest.fn(),
  };

  const mockQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamePlayersService,
        PaginationService,
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayerRepository,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
      ],
    }).compile();

    service = module.get<GamePlayersService>(GamePlayersService);
    gamePlayerRepository = module.get<Repository<GamePlayer>>(
      getRepositoryToken(GamePlayer),
    );
    gameRepository = module.get<Repository<Game>>(getRepositoryToken(Game));

    (gamePlayerRepository.createQueryBuilder as jest.Mock).mockReturnValue(
      mockQueryBuilder,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('leaveGameForUser', () => {
    it('throws when game does not exist', async () => {
      (gameRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.leaveGameForUser(1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when game is not pending', async () => {
      (gameRepository.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        status: GameStatus.STARTED,
      } as Game);

      await expect(service.leaveGameForUser(1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when user is not a player in the game', async () => {
      (gameRepository.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        status: GameStatus.PENDING,
      } as Game);
      (gamePlayerRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.leaveGameForUser(1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes player and compacts turn order when player has turn_order', async () => {
      (gameRepository.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        status: GameStatus.PENDING,
      } as Game);
      (gamePlayerRepository.findOne as jest.Mock).mockResolvedValue({
        id: 42,
        game_id: 1,
        user_id: 10,
        turn_order: 2,
      } as GamePlayer);

      await service.leaveGameForUser(1, 10);

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
      expect(gamePlayerRepository.delete).toHaveBeenCalledWith(42);
    });

    it('deletes player without updating turn order when turn_order is null', async () => {
      (gameRepository.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        status: GameStatus.PENDING,
      } as Game);
      (gamePlayerRepository.findOne as jest.Mock).mockResolvedValue({
        id: 43,
        game_id: 1,
        user_id: 11,
        turn_order: null,
      } as GamePlayer);

      await service.leaveGameForUser(1, 11);

      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(gamePlayerRepository.delete).toHaveBeenCalledWith(43);
    });
  });
});
