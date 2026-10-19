import { GamesSnapshotService } from './games-snapshot.service';

describe('GamesSnapshotService', () => {
  const gameRepository = {
    findOne: jest.fn(),
  };
  const playerRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  let service: GamesSnapshotService;

  const game = {
    id: 1,
    code: 'ABC123',
    status: 'RUNNING',
    mode: 'PUBLIC',
    number_of_players: 4,
    next_player_id: 7,
    creator_id: 7,
  };

  const players = [
    {
      id: 10,
      game_id: 1,
      user_id: 7,
      balance: 1400,
      position: 3,
      circle: 0,
      turn_order: 1,
      symbol: 'DOG',
      in_jail: false,
      in_jail_rolls: 0,
      rolled: 1,
      rolls: 2,
      chance_jail_card: true,
      community_chest_jail_card: false,
      user: { username: 'alice' },
    },
    {
      id: 11,
      game_id: 1,
      user_id: 8,
      balance: 1300,
      position: 15,
      circle: 1,
      turn_order: 2,
      symbol: 'CAR',
      in_jail: true,
      in_jail_rolls: 2,
      rolled: 0,
      rolls: 3,
      chance_jail_card: false,
      community_chest_jail_card: true,
      user: { username: 'bob' },
    },
  ];

  beforeEach(() => {
    gameRepository.findOne.mockReset().mockResolvedValue(game);
    playerRepository.find.mockReset().mockResolvedValue(players);
    playerRepository.findOne.mockReset().mockResolvedValue(null);
    service = new GamesSnapshotService(
      gameRepository as never,
      playerRepository as never,
    );
  });

  it('includes hidden jail cards only for the viewer own seat', async () => {
    const snapshot = await service.build(1, {
      userId: 7,
      role: 'player',
      seatId: 10,
    });

    const own = snapshot.players.find((p) => p.id === 10);
    const other = snapshot.players.find((p) => p.id === 11);
    expect(own?.chanceJailCard).toBe(true);
    expect(other?.chanceJailCard).toBeUndefined();
    expect(other?.communityChestJailCard).toBeUndefined();
    // Public state for everyone:
    expect(other?.inJail).toBe(true);
  });

  it('redacts hidden cards for every seat when the viewer is a spectator', async () => {
    const snapshot = await service.build(1, {
      userId: 99,
      role: 'spectator',
      seatId: null,
    });

    for (const player of snapshot.players) {
      expect(player.chanceJailCard).toBeUndefined();
      expect(player.communityChestJailCard).toBeUndefined();
    }
    expect(snapshot.viewer).toEqual({
      userId: 99,
      role: 'spectator',
      seatId: null,
    });
  });

  it('builds a public state with schemaVersion and no viewer/hidden fields', async () => {
    const state = await service.buildPublicState(1);

    expect(state.schemaVersion).toBe(1);
    expect(state.game).toEqual(
      expect.objectContaining({ id: 1, nextPlayerId: 7 }),
    );
    expect(state.players).toHaveLength(2);
    for (const player of state.players) {
      expect(player).not.toHaveProperty('chanceJailCard');
      expect(player).not.toHaveProperty('communityChestJailCard');
      expect(player).not.toHaveProperty('user');
    }
  });

  it('resolves a seat by game and user', async () => {
    playerRepository.findOne.mockResolvedValue(players[0]);
    const seat = await service.findSeat(1, 7);

    expect(playerRepository.findOne).toHaveBeenCalledWith({
      where: { game_id: 1, user_id: 7 },
    });
    expect(seat?.id).toBe(10);
  });
});
