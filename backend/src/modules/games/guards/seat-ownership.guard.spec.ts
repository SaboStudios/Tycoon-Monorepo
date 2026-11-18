import { BadRequestException } from '@nestjs/common';
import { SeatOwnershipGuard } from './seat-ownership.guard';

describe('SeatOwnershipGuard', () => {
  let gamesService: { isSeatOwner: jest.Mock };
  let guard: SeatOwnershipGuard;

  const buildContext = (params: Record<string, unknown>, user?: unknown) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ params, user }),
      }),
    }) as any;

  beforeEach(() => {
    gamesService = { isSeatOwner: jest.fn().mockResolvedValue(true) };
    guard = new SeatOwnershipGuard(gamesService as any, {} as any);
  });

  it('accepts a normal decimal id', async () => {
    const context = buildContext(
      { gameId: '42', playerId: '7' },
      { id: 'user-1' },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(gamesService.isSeatOwner).toHaveBeenCalledWith(42, 7, 'user-1');
  });

  it('rejects scientific notation ids', async () => {
    const context = buildContext(
      { gameId: '1e2', playerId: '7' },
      { id: 'user-1' },
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(gamesService.isSeatOwner).not.toHaveBeenCalled();
  });

  it('rejects empty ids', async () => {
    const context = buildContext(
      { gameId: '42', playerId: '' },
      { id: 'user-1' },
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(gamesService.isSeatOwner).not.toHaveBeenCalled();
  });

  it('rejects missing ids', async () => {
    const context = buildContext({ gameId: '42' }, { id: 'user-1' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(gamesService.isSeatOwner).not.toHaveBeenCalled();
  });

  it('rejects ids above the safe integer bound', async () => {
    const context = buildContext(
      { gameId: '9007199254740992', playerId: '7' },
      { id: 'user-1' },
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(gamesService.isSeatOwner).not.toHaveBeenCalled();
  });
});
