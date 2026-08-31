import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GamesService } from './games.service';
import { Game, GameStatus } from './entities/game.entity';
import { GameSettings } from './entities/game-settings.entity';
import { GamePlayer } from './entities/game-player.entity';
import { PaginationService } from '../../common';
import { GameFullException } from './exceptions/game-exceptions';

describe('GamesService.joinGame - room-full 409 mapping (#1297)', () => {
  let service: GamesService;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn((_entity, data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getRepositoryToken(Game), useValue: {} },
        { provide: getRepositoryToken(GameSettings), useValue: {} },
        { provide: getRepositoryToken(GamePlayer), useValue: {} },
        { provide: DataSource, useValue: mockDataSource },
        { provide: PaginationService, useValue: {} },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('throws GameFullException (409, GAME_FULL) when the room is full', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValueOnce({
      id: 7,
      status: GameStatus.PENDING,
      number_of_players: 2,
      settings: { startingCash: 1500 },
    });
    mockQueryRunner.manager.count.mockResolvedValueOnce(2);

    await expect(service.joinGame(7, 99, {})).rejects.toMatchObject({
      errorCode: 'GAME_FULL',
      getStatus: expect.any(Function),
    });

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('exposes a stable errorCode and HTTP 409 for frontend mapServerErrors', async () => {
    mockQueryRunner.manager.findOne.mockResolvedValueOnce({
      id: 7,
      status: GameStatus.PENDING,
      number_of_players: 2,
      settings: {},
    });
    mockQueryRunner.manager.count.mockResolvedValueOnce(2);

    try {
      await service.joinGame(7, 99, {});
      fail('expected GameFullException to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(GameFullException);
      expect(err.errorCode).toBe('GAME_FULL');
      expect(err.getStatus()).toBe(409);
    }
  });
});
