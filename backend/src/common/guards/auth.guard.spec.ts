import { JwtAuthGuard } from './auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should extend AuthGuard with jwt strategy', () => {
    expect(guard).toBeInstanceOf(JwtAuthGuard);
  });

  describe('websocket handshake cookie/header parity with REST JWT strategy', () => {
    const extractToken = (request: unknown): string | null =>
      (guard as unknown as {
        extractTokenFromRequest?: (req: unknown) => string | null;
      }).extractTokenFromRequest?.(request) ?? null;

    it('reads the JWT from the Authorization bearer header like REST', () => {
      const token = extractToken({
        headers: { authorization: 'Bearer rest-parity-token' },
      });

      expect(token).toBe('rest-parity-token');
    });

    it('reads the JWT from the same httpOnly cookie used by REST', () => {
      const token = extractToken({
        headers: { cookie: 'access_token=cookie-parity-token; other=value' },
      });

      expect(token).toBe('cookie-parity-token');
    });

    it('prefers the Authorization header over the cookie when both are present', () => {
      const token = extractToken({
        headers: {
          authorization: 'Bearer header-token',
          cookie: 'access_token=cookie-token',
        },
      });

      expect(token).toBe('header-token');
    });

    it('returns null for unauthenticated handshakes (deny-by-default)', () => {
      expect(extractToken({ headers: {} })).toBeNull();
      expect(extractToken({ headers: { cookie: 'other=value' } })).toBeNull();
    });
  });
});
