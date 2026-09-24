import { Test, TestingModule } from '@nestjs/testing';
import { GamePlayersService } from './game-players.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GamePlayer } from './entities/game-player.entity';
import { Game } from './entities/game.entity';
import { BoostService } from '../perks-boosts/services/boost.service';
import { PerksBoostsEvents } from '../perks-boosts/services/perks-boosts-events.service';
import { PaginationService } from '../../common';
import { BoostType } from '../perks-boosts/enums/perk-boost.enums';

describe('GamePlayersService - Boost Integration', () => {
  let service: GamePlayersService;
  let boostService: BoostService;
  let events: PerksBoostsEvents;

  const mockGamePlayerRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockGameRepository = {
    findOne: jest.fn(),
  };

  const mockBoostService = {
    calculateModifiedValue: jest.fn(),
  };

  const mockEvents = {
    emit: jest.fn(),
  };

  const mockPaginationService = {
    paginate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamePlayersService,
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayerRepository,
        },
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
        {
          provide: BoostService,
          useValue: mockBoostService,
        },
        {
          provide: PerksBoostsEvents,
          useValue: mockEvents,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
      ],
    }).compile();

    service = module.get<GamePlayersService>(GamePlayersService);
    boostService = module.get<BoostService>(BoostService);
    events = module.get<PerksBoostsEvents>(PerksBoostsEvents);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rollDice - Dice Modifier Boost', () => {
    it('should apply dice modifier boost to dice roll', async () => {
      const mockPlayer = {
        id: 1,
        user_id: 10,
        game_id: 5,
        position: 0,
        balance: 1500,
        rolled: 0,
        rolls: 0,
        in_jail: false,
        in_jail_rolls: 0,
        circle: 0,
      };

      mockGamePlayerRepository.findOne.mockResolvedValue(mockPlayer);
      mockBoostService.calculateModifiedValue
        .mockResolvedValueOnce(8) // DICE_MODIFIER: 3+3 = 6 -> 8
        .mockResolvedValueOnce(8); // SPEED_BOOST: no change

      mockGamePlayerRepository.save.mockResolvedValue({
        ...mockPlayer,
        position: 8,
        rolled: 1,
        rolls: 1,
      });

      const result = await service.rollDice(5, 1, 3, 3);

      expect(boostService.calculateModifiedValue).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 10,
          gameId: 5,
          baseValue: 6,
        }),
        BoostType.DICE_MODIFIER,
      );
      expect(result.position).toBe(8);
    });

    it('should apply speed boost for free movement', async () => {
      const mockPlayer = {
        id: 1,
        user_id: 10,
        game_id: 5,
        position: 0,
        balance: 1500,
        rolled: 0,
        rolls: 0,
        in_jail: false,
        in_jail_rolls: 0,
        circle: 0,
      };

      mockGamePlayerRepository.findOne.mockResolvedValue(mockPlayer);
      mockBoostService.calculateModifiedValue
        .mockResolvedValueOnce(7) // DICE_MODIFIER
        .mockResolvedValueOnce(10); // SPEED_BOOST: 7 -> 10

      mockGamePlayerRepository.save.mockResolvedValue({
        ...mockPlayer,
        position: 10,
        rolled: 1,
        rolls: 1,
      });

      await service.rollDice(5, 1, 4, 3);

      expect(boostService.calculateModifiedValue).toHaveBeenCalledWith(
        expect.objectContaining({
          baseValue: 7,
        }),
        BoostType.SPEED_BOOST,
      );
    });

    it('should apply double income boost when passing GO', async () => {
      const mockPlayer = {
        id: 1,
        user_id: 10,
        game_id: 5,
        position: 38,
        balance: 1500,
        rolled: 0,
        rolls: 0,
        in_jail: false,
        in_jail_rolls: 0,
        circle: 0,
      };

      mockGamePlayerRepository.findOne.mockResolvedValue(mockPlayer);
      mockBoostService.calculateModifiedValue
        .mockResolvedValueOnce(5) // DICE_MODIFIER
        .mockResolvedValueOnce(5) // SPEED_BOOST
        .mockResolvedValueOnce(400); // CASH_REWARD: 200 -> 400 (double income)

      mockGamePlayerRepository.save.mockResolvedValue({
        ...mockPlayer,
        position: 3,
        balance: 1900,
        circle: 1,
        rolled: 1,
        rolls: 1,
      });

      const result = await service.rollDice(5, 1, 2, 3);

      expect(boostService.calculateModifiedValue).toHaveBeenCalledWith(
        expect.objectContaining({
          baseValue: 200,
        }),
        BoostType.CASH_REWARD,
      );
      expect(result.balance).toBe(1900);
    });
  });

  describe('payRent - Rent Multiplier Boost', () => {
    it('should apply rent multiplier boost', async () => {
      const mockPayer = {
        id: 1,
        user_id: 10,
        game_id: 5,
        balance: 1500,
      };

      const mockPayee = {
        id: 2,
        user_id: 20,
        game_id: 5,
        balance: 1000,
      };

      mockGamePlayerRepository.findOne
        .mockResolvedValueOnce(mockPayer)
        .mockResolvedValueOnce(mockPayee);

      mockBoostService.calculateModifiedValue.mockResolvedValue(200); // 100 -> 200 (2x multiplier)

      mockGamePlayerRepository.save.mockResolvedValue([
        { ...mockPayer, balance: 1300 },
        { ...mockPayee, balance: 1200 },
      ]);

      const result = await service.payRent(5, 1, 2, 100);

      expect(boostService.calculateModifiedValue).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 20,
          gameId: 5,
          baseValue: 100,
        }),
        BoostType.RENT_MULTIPLIER,
      );
      expect(result.finalRent).toBe(200);
    });

    it('should handle rent reduction boost', async () => {
      const mockPayer = {
        id: 1,
        user_id: 10,
        game_id: 5,
        balance: 1500,
      };

      const mockPayee = {
        id: 2,
        user_id: 20,
        game_id: 5,
        balance: 1000,
      };

      mockGamePlayerRepository.findOne
        .mockResolvedValueOnce(mockPayer)
        .mockResolvedValueOnce(mockPayee);

      mockBoostService.calculateModifiedValue.mockResolvedValue(50); // 100 -> 50 (50% reduction)

      mockGamePlayerRepository.save.mockResolvedValue([
        { ...mockPayer, balance: 1450 },
        { ...mockPayee, balance: 1050 },
      ]);

      const result = await service.payRent(5, 1, 2, 100);

      expect(result.finalRent).toBe(50);
    });
  });

  describe('payTax - Tax Reduction Boost', () => {
    it('should apply tax reduction boost', async () => {
      const mockPlayer = {
        id: 1,
        user_id: 10,
        game_id: 5,
        balance: 1500,
      };

      mockGamePlayerRepository.findOne.mockResolvedValue(mockPlayer);
      mockBoostService.calculateModifiedValue.mockResolvedValue(100); // 200 -> 100 (50% reduction)

      mockGamePlayerRepository.save.mockResolvedValue({
        ...mockPlayer,
        balance: 1400,
      });

      const result = await service.payTax(5, 1, 200);

      expect(boostService.calculateModifiedValue).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 10,
          gameId: 5,
          baseValue: 200,
        }),
        BoostType.TAX_REDUCTION,
      );
      expect(result.finalTax).toBe(100);
    });

    it('should apply tax immunity (100% reduction)', async () => {
      const mockPlayer = {
        id: 1,
        user_id: 10,
        game_id: 5,
        balance: 1500,
      };

      mockGamePlayerRepository.findOne.mockResolvedValue(mockPlayer);
      mockBoostService.calculateModifiedValue.mockResolvedValue(0); // 200 -> 0 (tax immunity)

      mockGamePlayerRepository.save.mockResolvedValue({
        ...mockPlayer,
        balance: 1500,
      });

      const result = await service.payTax(5, 1, 200);

      expect(result.finalTax).toBe(0);
      expect(result.player.balance).toBe(1500);
    });
  });

  describe('buyProperty - Event Emission', () => {
    it('should emit PROPERTY_PURCHASE event', async () => {
      const mockPlayer = {
        id: 1,
        user_id: 10,
        game_id: 5,
        balance: 1500,
      };

      mockGamePlayerRepository.findOne.mockResolvedValue(mockPlayer);
      mockGamePlayerRepository.save.mockResolvedValue({
        ...mockPlayer,
        balance: 1200,
      });

      await service.buyProperty(5, 1, 300, 15);

      expect(events.emit).toHaveBeenCalledWith(
        'property.purchase',
        expect.objectContaining({
          playerId: 10,
          gameId: 5,
          metadata: { propertyId: 15, propertyCost: 300 },
        }),
      );
    });
  });
});
