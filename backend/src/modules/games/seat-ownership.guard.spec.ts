import {
  ArgumentsHost,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SeatOwnershipGuard } from './guards/seat-ownership.guard';
import { GamePlayersService } from './game-players.service';

function contextFor(req: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ArgumentsHost as ExecutionContext;
}

describe('SeatOwnershipGuard', () => {
  const gamePlayersService = {
    findByGameAndPlayer: jest.fn(),
    findOne: jest.fn(),
  };
  const guard = new SeatOwnershipGuard(
    gamePlayersService as unknown as GamePlayersService,
  );

  const seat = { id: 30, game_id: 1, user_id: 5 };

  beforeEach(() => {
    gamePlayersService.findByGameAndPlayer.mockReset();
    gamePlayersService.findOne.mockReset();
  });

  it('allows the seat owner', async () => {
    gamePlayersService.findByGameAndPlayer.mockResolvedValue(seat);
    const req = {
      user: { id: 5, role: 'user' },
      params: { gameId: '1', playerId: '30' },
    };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
  });

  it('allows an admin acting for any seat', async () => {
    gamePlayersService.findByGameAndPlayer.mockResolvedValue(seat);
    const req = {
      user: { id: 99, role: 'admin', is_admin: true },
      params: { gameId: '1', playerId: '30' },
    };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
  });

  it('hides seats owned by other users with 404 (no enumeration)', async () => {
    gamePlayersService.findByGameAndPlayer.mockResolvedValue(seat);
    const req = {
      user: { id: 6, role: 'user' },
      params: { gameId: '1', playerId: '30' },
    };

    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
      /not found/i,
    );
  });

  it('rejects an unauthenticated request', async () => {
    const req = { params: { gameId: '1', playerId: '30' } };
    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('scopes by game when gameId is present', async () => {
    gamePlayersService.findByGameAndPlayer.mockResolvedValue(seat);
    await guard.canActivate(
      contextFor({
        user: { id: 5 },
        params: { gameId: '1', playerId: '30' },
      }),
    );
    expect(gamePlayersService.findByGameAndPlayer).toHaveBeenCalledWith(1, 30);
    expect(gamePlayersService.findOne).not.toHaveBeenCalled();
  });

  it('resolves the seat without a gameId using the player id', async () => {
    gamePlayersService.findOne.mockResolvedValue(seat);
    await guard.canActivate(
      contextFor({ user: { id: 5 }, params: { id: '30' } }),
    );
    expect(gamePlayersService.findOne).toHaveBeenCalledWith(30);
  });
});
