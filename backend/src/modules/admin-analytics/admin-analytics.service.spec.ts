import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { AdminAnalyticsService } from './admin-analytics.service';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let userRepo: Repository<User>;
  let gameRepo: Repository<Game>;
  let gamePlayerRepo: Repository<GamePlayer>;

  const mockUserRepo = {
    count: jest.fn(),
  };

  const mockGameRepo = {
    count: jest.fn(),
  };

  const mockGamePlayerRepo = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepo,
        },
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayerRepo,
        },
      ],
    }).compile();

    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    gameRepo = module.get<Repository<Game>>(getRepositoryToken(Game));
    gamePlayerRepo = module.get<Repository<GamePlayer>>(
      getRepositoryToken(GamePlayer),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTotalUsers', () => {
    it('should return total users count', async () => {
      mockUserRepo.count.mockResolvedValue(100);

      const result = await service.getTotalUsers();

      expect(result).toBe(100);
      expect(userRepo.count).toHaveBeenCalled();
    });
  });

  describe('getActiveUsers', () => {
    it('should return active users count', async () => {
      mockUserRepo.count.mockResolvedValue(50);

      const result = await service.getActiveUsers();

      expect(result).toBe(50);
      expect(userRepo.count).toHaveBeenCalledWith({
        where: {
          updated_at: expect.objectContaining({
            _type: 'moreThan',
            _value: expect.any(Date),
          }),
        },
      });
    });
  });

  describe('getTotalGames', () => {
    it('should return total games count', async () => {
      mockGameRepo.count.mockResolvedValue(200);

      const result = await service.getTotalGames();

      expect(result).toBe(200);
      expect(gameRepo.count).toHaveBeenCalled();
    });
  });

  describe('getTotalGamePlayers', () => {
    it('should return total game players count', async () => {
      mockGamePlayerRepo.count.mockResolvedValue(400);

      const result = await service.getTotalGamePlayers();

      expect(result).toBe(400);
      expect(gamePlayerRepo.count).toHaveBeenCalled();
    });
  });

  describe('getDashboardAnalytics', () => {
    it('should return all analytics data', async () => {
      mockUserRepo.count.mockResolvedValueOnce(100).mockResolvedValueOnce(50);
      mockGameRepo.count.mockResolvedValue(200);
      mockGamePlayerRepo.count.mockResolvedValue(400);

      const result = await service.getDashboardAnalytics();

      expect(result).toEqual({
        totalUsers: 100,
        activeUsers: 50,
        totalGames: 200,
        totalGamePlayers: 400,
      });
    });
  });
});
