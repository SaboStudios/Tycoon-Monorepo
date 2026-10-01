import { JwtService } from '@nestjs/jwt';
import { GameActionError, GameActionErrorCode } from './game-action.error';
import { GamesRealtimeBridge } from './games-realtime.bridge';
import { WsAuthService } from './ws-auth.service';

const SECRET = 'ws-auth-spec-secret';

function socketWith(
  headers: Record<string, string | undefined>,
  auth?: unknown,
) {
  return {
    handshake: { headers, auth },
  } as never;
}

describe('WsAuthService', () => {
  const userRepository = {
    findOne: jest.fn(),
  };
  const bridge = new GamesRealtimeBridge();
  const jwtService = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: '15m' },
  });
  let service: WsAuthService;

  beforeEach(() => {
    userRepository.findOne.mockReset();
    bridge.reset();
    service = new WsAuthService(jwtService, userRepository as never, bridge);
  });

  function sign(payload: Record<string, unknown>): string {
    return jwtService.sign(payload as never);
  }

  const validClaims = {
    sub: 42,
    id: 42,
    email: 'a@b.c',
    role: 'user',
    is_admin: false,
  };

  describe('extractToken precedence (ADR-004 chain)', () => {
    it('prefers the access_token cookie over other sources', () => {
      const token = service.extractToken(
        socketWith(
          {
            cookie: 'other=x; access_token=cookie-token',
            authorization: 'Bearer header-token',
          },
          { token: 'handshake-token' },
        ),
      );
      expect(token).toBe('cookie-token');
    });

    it('falls back to the Authorization Bearer header', () => {
      const token = service.extractToken(
        socketWith(
          { authorization: 'Bearer header-token' },
          { token: 'handshake-token' },
        ),
      );
      expect(token).toBe('header-token');
    });

    it('falls back to the auth.token handshake field', () => {
      const token = service.extractToken(
        socketWith({}, { token: 'handshake-token' }),
      );
      expect(token).toBe('handshake-token');
    });

    it('returns undefined when no token source exists', () => {
      expect(service.extractToken(socketWith({}))).toBeUndefined();
    });

    it('url-decodes cookie values', () => {
      expect(
        WsAuthService.parseCookie('access_token=abc%2Fdef', 'access_token'),
      ).toBe('abc/def');
    });
  });

  describe('authenticate', () => {
    it('rejects a missing token with AUTH_REQUIRED', async () => {
      await expect(service.authenticate(socketWith({}))).rejects.toMatchObject({
        code: GameActionErrorCode.AUTH_REQUIRED,
      });
    });

    it('rejects a tampered token with AUTH_REQUIRED', async () => {
      const token = `${sign(validClaims).slice(0, -3)}xxx`;
      await expect(
        service.authenticate(socketWith({ authorization: `Bearer ${token}` })),
      ).rejects.toMatchObject({ code: GameActionErrorCode.AUTH_REQUIRED });
    });

    it('returns the verified principal from a valid token', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 42,
        role: 'user',
        is_admin: false,
        is_suspended: false,
      });
      const principal = await service.authenticate(
        socketWith({ authorization: `Bearer ${sign(validClaims)}` }),
      );
      expect(principal).toEqual(
        expect.objectContaining({ userId: 42, isAdmin: false }),
      );
      expect(principal.exp).toBeGreaterThan(0);
    });

    it('rejects a suspended user with USER_BANNED', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 42,
        role: 'user',
        is_admin: false,
        is_suspended: true,
      });
      await expect(
        service.authenticate(
          socketWith({ authorization: `Bearer ${sign(validClaims)}` }),
        ),
      ).rejects.toMatchObject({ code: GameActionErrorCode.USER_BANNED });
    });

    it('rejects a locally banned principal even with a valid token', async () => {
      await bridge.notifyUserBanned(42);
      await expect(
        service.authenticate(
          socketWith({ authorization: `Bearer ${sign(validClaims)}` }),
        ),
      ).rejects.toMatchObject({ code: GameActionErrorCode.USER_BANNED });
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('rejects a deleted account with AUTH_REQUIRED', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(
        service.authenticate(
          socketWith({ authorization: `Bearer ${sign(validClaims)}` }),
        ),
      ).rejects.toMatchObject({ code: GameActionErrorCode.AUTH_REQUIRED });
    });
  });

  describe('assertNotExpired', () => {
    it('passes for a future exp', () => {
      expect(() =>
        WsAuthService.assertNotExpired({
          userId: 1,
          role: 'user',
          isAdmin: false,
          exp: Math.floor(Date.now() / 1000) + 60,
        }),
      ).not.toThrow();
    });

    it('throws AUTH_EXPIRED once the token is past exp', () => {
      try {
        WsAuthService.assertNotExpired({
          userId: 1,
          role: 'user',
          isAdmin: false,
          exp: Math.floor(Date.now() / 1000) - 1,
        });
        fail('expected AUTH_EXPIRED');
      } catch (err) {
        expect((err as GameActionError).code).toBe(
          GameActionErrorCode.AUTH_EXPIRED,
        );
      }
    });
  });
});
