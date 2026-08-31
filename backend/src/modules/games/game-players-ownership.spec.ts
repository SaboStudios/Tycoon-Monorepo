import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GamePlayersService } from './game-players.service';
import { GamePlayer } from './entities/game-player.entity';
import { Game } from './entities/game.entity';
import { BoostService } from '../perks-boosts/services/boost.service';
import { PerksBoostsEvents } from '../perks-boosts/services/perks-boosts-events.service';
import { PaginationService } from '../../common';

describe('GamePlayersService - pay-rent/unlock-balance validation (#1298)', () => {
  let service: GamePlayersService;

  const mockGamePlayerRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockGameRepository = { findOne: jest.fn() };
  const mockBoostService = { calculateModifiedValue: jest.fn() };
  const mockEvents = { emit: jest.fn() };
  const mockPaginationService = { paginate: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamePlayersService,
        { provide: getRepositoryToken(GamePlayer), useValue: mockGamePlayerRepository },
        { provide: getRepositoryToken(Game), useValue: mockGameRepository },
        { provide: BoostService, useValue: mockBoostService },
        { provide: PerksBoostsEvents, useValue: mockEvents },
        { provide: PaginationService, useValue: mockPaginationService },
      ],
    }).compile();

    service = module.get<GamePlayersService>(GamePlayersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('unlockBalance', () => {
    it('rejects non-positive amounts', async () => {
      await expect(service.unlockBalance(1, 0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.unlockBalance(1, -5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when requester does not own the player', async () => {
      mockGamePlayerRepository.findOne.mockResolvedValue({
        id: 1,
        user_id: 10,
        trade_locked_balance: '50',
      });

      await expect(service.unlockBalance(1, 10, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows the owning user to unlock', async () => {
      const player = { id: 1, user_id: 10, trade_locked_balance: '50' };
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation((p) => p);

      const result = await service.unlockBalance(1, 10, 10);
      expect(result.trade_locked_balance).toBe('40.00');
    });
  });

  describe('payRent', () => {
    it('rejects when requester is not the payer', async () => {
      mockGamePlayerRepository.findOne
        .mockResolvedValueOnce({ id: 1, user_id: 10, game_id: 5, balance: 100 })
        .mockResolvedValueOnce({ id: 2, user_id: 20, game_id: 5, balance: 0 });

      await expect(service.payRent(5, 1, 2, 50, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows the owning payer to pay rent', async () => {
      mockGamePlayerRepository.findOne
        .mockResolvedValueOnce({ id: 1, user_id: 10, game_id: 5, balance: 100 })
        .mockResolvedValueOnce({ id: 2, user_id: 20, game_id: 5, balance: 0 });
      mockBoostService.calculateModifiedValue.mockResolvedValue(50);
      mockGamePlayerRepository.save.mockResolvedValue([]);

      const result = await service.payRent(5, 1, 2, 50, 10);
      expect(result.finalRent).toBe(50);
    });
  });
});
