base64: invalid input

import { GamesGateway } from './games.gateway';
import { GamesService } from './games.service';
import { GameActionError, GameActionErrorCode } from './game-action.error';

describe('GamesGateway - Spectator Authorization', () => {
  let gateway: GamesGateway;
  let mockGamesService: jest.Mocked<GamesService>;

  beforeEach(() => {
    mockGamesService = {
      authenticateSocket: jest.fn(),
      authorizeJoin: jest.fn(),
      getSnapshot: jest.fn(),
      roll: jest.fn(),
      detachSocket: jest.fn(),
    } as any;
    gateway = new GamesGateway(mockGamesService);
  });

  describe('spectator role enforcement', () => {
    it('allows spectator to join and receive snapshot', async () => {
      const client = {
        data: { userId: 'user-1' },
        join: jest.fn(),
        emit: jest.fn(),
      } as any;

      mockGamesService.authorizeJoin.mockResolvedValue(undefined);
      mockGamesService.getSnapshot.mockResolvedValue({ players: [], turn: 1 });

      await gateway.handleJoin(client, { gameId: 'game-1', asSpectator: true });

      expect(client.data.role).toBe('spectator');
      expect(client.join).toHaveBeenCalledWith('game_game-1');
      expect(client.emit).toHaveBeenCalledWith('game:snapshot', expect.any(Object));
    });

    it('rejects roll from spectator', async () => {
      const client = {
        data: { userId: 'user-1', role: 'spectator', gameId: 'game-1' },
        emit: jest.fn(),
      } as any;

      await gateway.handleRoll(client, { gameId: 'game-1', idempotencyKey: 'key-1' });

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: GameActionErrorCode.FORBIDDEN_SPECTATOR }),
      );
    });

    it('allows player to roll', async () => {
      const client = {
        data: { userId: 'user-1', role: 'player', gameId: 'game-1' },
        emit: jest.fn(),
      } as any;

      mockGamesService.roll.mockResolvedValue({ players: [], turn: 2 });

      await gateway.handleRoll(client, { gameId: 'game-1', idempotencyKey: 'key-1' });

      expect(mockGamesService.roll).toHaveBeenCalledWith('user-1', 'game-1', 'key-1');
    });

    it('rejects unauthenticated connection', async () => {
      mockGamesService.authenticateSocket.mockRejectedValue(new Error('Invalid token'));
      const client = {
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', { code: GameActionErrorCode.UNAUTHORIZED });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });
});
