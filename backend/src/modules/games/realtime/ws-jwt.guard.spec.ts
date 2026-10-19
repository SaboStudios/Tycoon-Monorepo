import { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { GameActionErrorCode } from './game-action.error';
import { GamesRealtimeBridge } from './games-realtime.bridge';
import { WsJwtGuard } from './ws-jwt.guard';

function hostFor(client: unknown): ExecutionContext {
  return {
    switchToWs: () => ({
      getClient: () => client,
      getData: () => ({}),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ArgumentsHost as ExecutionContext;
}

function thrown(fn: () => void): { code?: string } {
  try {
    fn();
    fail('expected a WsException');
    return {};
  } catch (err) {
    expect(err).toBeInstanceOf(WsException);
    return (err as WsException).getError() as { code?: string };
  }
}

describe('WsJwtGuard', () => {
  let bridge: GamesRealtimeBridge;
  let guard: WsJwtGuard;

  beforeEach(() => {
    bridge = new GamesRealtimeBridge();
    guard = new WsJwtGuard(bridge);
  });

  const validPrincipal = {
    userId: 5,
    role: 'user',
    isAdmin: false,
    exp: Math.floor(Date.now() / 1000) + 300,
  };

  it('allows an authenticated, unexpired, non-banned principal', () => {
    const client = { data: { principal: validPrincipal } };
    expect(guard.canActivate(hostFor(client))).toBe(true);
  });

  it('rejects a socket with no principal with AUTH_REQUIRED', () => {
    const client = { data: {} };
    const payload = thrown(() => guard.canActivate(hostFor(client)));
    expect(payload.code).toBe(GameActionErrorCode.AUTH_REQUIRED);
  });

  it('rejects an expired token with AUTH_EXPIRED', () => {
    const client = {
      data: {
        principal: {
          ...validPrincipal,
          exp: Math.floor(Date.now() / 1000) - 1,
        },
      },
    };
    const payload = thrown(() => guard.canActivate(hostFor(client)));
    expect(payload.code).toBe(GameActionErrorCode.AUTH_EXPIRED);
  });

  it('rejects a principal banned after handshake with USER_BANNED', async () => {
    const client = { data: { principal: validPrincipal } };
    await bridge.notifyUserBanned(validPrincipal.userId);
    const payload = thrown(() => guard.canActivate(hostFor(client)));
    expect(payload.code).toBe(GameActionErrorCode.USER_BANNED);
    // Sticky: subsequent checks short-circuit on the socket flag.
    expect(client.data.terminated).toBe(true);
    expect(thrown(() => guard.canActivate(hostFor(client))).code).toBe(
      GameActionErrorCode.USER_BANNED,
    );
  });

  it('rejects a socket flagged terminated by a prior teardown', () => {
    const client = { data: { principal: validPrincipal, terminated: true } };
    const payload = thrown(() => guard.canActivate(hostFor(client)));
    expect(payload.code).toBe(GameActionErrorCode.USER_BANNED);
  });
});
