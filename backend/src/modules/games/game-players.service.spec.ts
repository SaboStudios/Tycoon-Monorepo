import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamePlayersService } from './game-players.service';
import { Game } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { PaginationService } from '../../common/services/pagination.service';

describe('GamePlayersService', () => {
  let service: GamePlayersService;
  let gameRepository: Repository<Game>;
  let gamePlayerRepository: Repository<GamePlayer>;

  const mockGameRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockGamePlayerRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockPaginationService = {
    paginate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamePlayersService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayerRepository,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
      ],
    }).compile();

    service = module.get<GamePlayersService>(GamePlayersService);
    gameRepository = module.get<Repository<Game>>(getRepositoryToken(Game));
    gamePlayerRepository = module.get<Repository<GamePlayer>>(
      getRepositoryToken(GamePlayer),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('advanceTurn', () => {
    it('rotates to the next non-jailed player and updates next_player_id', async () => {
      const game: Game = {
        id: 1,
        code: 'ABC123',
        mode: null,
        creator_id: 1,
        status: null,
        winner_id: null,
        number_of_players: 3,
        next_player_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        is_ai: false,
        is_minipay: false,
        chain: null,
        duration: null,
        started_at: null,
        contract_game_id: null,
        placements: null,
        creator: null,
        winner: null,
        nextPlayer: null,
      } as unknown as Game;

      const players: GamePlayer[] = [
        {
          id: 1,
          game_id: 1,
          user_id: 1,
          symbol: 'A',
          position: 0,
          balance: 0,
          in_jail: false,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 1,
          turn_start: '100',
          consecutive_timeouts: 0,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
        {
          id: 2,
          game_id: 1,
          user_id: 2,
          symbol: 'B',
          position: 0,
          balance: 0,
          in_jail: true,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 2,
          turn_start: null,
          consecutive_timeouts: 0,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
        {
          id: 3,
          game_id: 1,
          user_id: 3,
          symbol: 'C',
          position: 0,
          balance: 0,
          in_jail: false,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 3,
          turn_start: null,
          consecutive_timeouts: 0,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
      ];

      mockGameRepository.findOne.mockResolvedValue(game);
      mockGameRepository.save.mockImplementation(async (g) => g);
      mockGamePlayerRepository.find.mockResolvedValue(players);
      mockGamePlayerRepository.save.mockImplementation(
        async (entities) => entities,
      );

      await service.advanceTurn(1, 1, { isTimeout: false, now: '200' });

      expect(gamePlayerRepository.find).toHaveBeenCalledWith({
        where: { game_id: 1 },
        order: { turn_order: 'ASC' },
      });

      expect(gamePlayerRepository.save).toHaveBeenCalledTimes(1);
      const savedArgs = (gamePlayerRepository.save as jest.Mock).mock
        .calls[0][0];
      const [savedCurrent, savedNext] = savedArgs as GamePlayer[];

      expect(savedCurrent.user_id).toBe(1);
      expect(savedCurrent.turn_start).toBeNull();
      expect(savedCurrent.consecutive_timeouts).toBe(0);

      expect(savedNext.user_id).toBe(3);
      expect(savedNext.turn_start).toBe('200');
      expect(savedNext.turn_count).toBe(1);
      expect(savedNext.consecutive_timeouts).toBe(0);
      expect(savedNext.rolled).toBe(0);

      expect(gameRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          next_player_id: 3,
        }),
      );
    });

    it('increments consecutive_timeouts on timeout', async () => {
      const game: Game = {
        id: 1,
        code: 'ABC123',
        mode: null,
        creator_id: 1,
        status: null,
        winner_id: null,
        number_of_players: 2,
        next_player_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        is_ai: false,
        is_minipay: false,
        chain: null,
        duration: null,
        started_at: null,
        contract_game_id: null,
        placements: null,
        creator: null,
        winner: null,
        nextPlayer: null,
      } as unknown as Game;

      const players: GamePlayer[] = [
        {
          id: 1,
          game_id: 1,
          user_id: 1,
          symbol: 'A',
          position: 0,
          balance: 0,
          in_jail: false,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 1,
          turn_start: '100',
          consecutive_timeouts: 1,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
        {
          id: 2,
          game_id: 1,
          user_id: 2,
          symbol: 'B',
          position: 0,
          balance: 0,
          in_jail: false,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 2,
          turn_start: null,
          consecutive_timeouts: 0,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
      ];

      mockGameRepository.findOne.mockResolvedValue(game);
      mockGameRepository.save.mockImplementation(async (g) => g);
      mockGamePlayerRepository.find.mockResolvedValue(players);
      mockGamePlayerRepository.save.mockImplementation(
        async (entities) => entities,
      );

      await service.advanceTurn(1, 1, { isTimeout: true, now: '200' });

      const savedArgs = (gamePlayerRepository.save as jest.Mock).mock
        .calls[0][0];
      const [savedCurrent, savedNext] = savedArgs as GamePlayer[];

      expect(savedCurrent.user_id).toBe(1);
      expect(savedCurrent.consecutive_timeouts).toBe(2);
      expect(savedCurrent.last_timeout_turn_start).toBe('100');
      expect(savedCurrent.turn_start).toBeNull();

      expect(savedNext.user_id).toBe(2);
      expect(savedNext.turn_start).toBe('200');
      expect(savedNext.turn_count).toBe(1);
      expect(savedNext.rolled).toBe(0);
    });
  });
});
