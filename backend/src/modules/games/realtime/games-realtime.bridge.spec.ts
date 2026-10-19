import { GameActionErrorCode } from './game-action.error';
import { GamesRealtimeBridge } from './games-realtime.bridge';

describe('GamesRealtimeBridge', () => {
  let bridge: GamesRealtimeBridge;
  let handler: {
    unsubscribeUser: jest.Mock;
    endGame: jest.Mock;
  };

  beforeEach(() => {
    bridge = new GamesRealtimeBridge();
    handler = {
      unsubscribeUser: jest.fn().mockResolvedValue(undefined),
      endGame: jest.fn().mockResolvedValue(undefined),
    };
    bridge.register(handler);
  });

  it('forwards a ban signal to the registered gateway handler', async () => {
    await bridge.notifyUserBanned(9);

    expect(handler.unsubscribeUser).toHaveBeenCalledWith(
      9,
      GameActionErrorCode.USER_BANNED,
    );
    expect(bridge.getUserTermination(9)).toBe(GameActionErrorCode.USER_BANNED);
  });

  it('is idempotent: a repeated ban does not emit a second terminal event', async () => {
    await bridge.notifyUserBanned(9);
    await bridge.notifyUserBanned(9);

    expect(handler.unsubscribeUser).toHaveBeenCalledTimes(1);
  });

  it('clears the local termination when the user is restored', async () => {
    await bridge.notifyUserBanned(9);
    bridge.notifyUserRestored(9);

    expect(bridge.getUserTermination(9)).toBeUndefined();
  });

  it('forwards a force-end signal and is idempotent per game', async () => {
    await bridge.notifyGameEnded(3);
    await bridge.notifyGameEnded(3);

    expect(handler.endGame).toHaveBeenCalledTimes(1);
    expect(handler.endGame).toHaveBeenCalledWith(
      3,
      GameActionErrorCode.GAME_ENDED,
    );
    expect(bridge.getGameTermination(3)).toBe(GameActionErrorCode.GAME_ENDED);
  });

  it('keeps termination flags when no gateway handler is registered', async () => {
    bridge.unregister(handler);
    await bridge.notifyUserBanned(11);

    expect(handler.unsubscribeUser).not.toHaveBeenCalled();
    expect(bridge.getUserTermination(11)).toBe(GameActionErrorCode.USER_BANNED);
  });

  it('reset clears all local state (test seam)', async () => {
    await bridge.notifyUserBanned(1);
    await bridge.notifyGameEnded(2);
    bridge.reset();

    expect(bridge.getUserTermination(1)).toBeUndefined();
    expect(bridge.getGameTermination(2)).toBeUndefined();
  });
});
