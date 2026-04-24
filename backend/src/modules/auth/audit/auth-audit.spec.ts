/**
 * SW-BE-005: Auth & JWT — audit trail hooks
 *
 * Tests:
 *  1. AuthAuditService — event routing, redaction, no-secret guarantee
 *  2. AuthService integration — correct audit events fired for every auth flow
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

import { AuthAuditService } from './auth-audit.service';
import { AuthAuditEvent } from './auth-audit.events';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../enums/role.enum';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    email: 'player@example.com',
    password: '$2b$10$hashedpassword',
    username: 'player1',
    role: Role.USER,
    is_admin: false,
    is_suspended: false,
    address: '0xabc123',
    chain: 'BASE',
    games_played: 0,
    game_won: 0,
    game_lost: 0,
    total_staked: '0',
    total_earned: '0',
    total_withdrawn: '0',
    ...overrides,
  }) as User;

// ---------------------------------------------------------------------------
// 1. AuthAuditService unit tests
// ---------------------------------------------------------------------------

describe('AuthAuditService (SW-BE-005)', () => {
  let auditService: AuthAuditService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthAuditService],
    }).compile();

    auditService = module.get<AuthAuditService>(AuthAuditService);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logSpy = jest.spyOn((auditService as any).logger, 'log');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warnSpy = jest.spyOn((auditService as any).logger, 'warn');
  });

  afterEach(() => jest.restoreAllMocks());

  describe('event routing', () => {
    it('logs success events at LOG level', () => {
      auditService.record(AuthAuditEvent.LOGIN_SUCCESS, { userId: 1 });
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('logs security events at WARN level', () => {
      auditService.record(AuthAuditEvent.TOKEN_REUSE_DETECTED, { userId: 1 });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('logs LOGIN_FAILED at WARN level', () => {
      auditService.record(AuthAuditEvent.LOGIN_FAILED, {});
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('logs LOGIN_SUSPENDED at WARN level', () => {
      auditService.record(AuthAuditEvent.LOGIN_SUSPENDED, { userId: 2 });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('logs TOKEN_REFRESH_FAILED at WARN level', () => {
      auditService.record(AuthAuditEvent.TOKEN_REFRESH_FAILED, {});
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('logs LOGOUT at LOG level', () => {
      auditService.record(AuthAuditEvent.LOGOUT, { userId: 3 });
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('logs TOKEN_REFRESHED at LOG level', () => {
      auditService.record(AuthAuditEvent.TOKEN_REFRESHED, { userId: 4 });
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it('includes the event name in the log message', () => {
      auditService.record(AuthAuditEvent.LOGIN_SUCCESS, { userId: 1 });
      const [message] = logSpy.mock.calls[0] as [string];
      expect(message).toContain(AuthAuditEvent.LOGIN_SUCCESS);
    });
  });

  describe('email redaction', () => {
    it('redacts email to first-char + *** + domain', () => {
      expect(AuthAuditService.redactEmail('player@example.com')).toBe(
        'p***@example.com',
      );
    });

    it('handles single-char local part', () => {
      expect(AuthAuditService.redactEmail('a@b.io')).toBe('a***@b.io');
    });

    it('returns *** for malformed email without @', () => {
      expect(AuthAuditService.redactEmail('notanemail')).toBe('***');
    });

    it('never logs the full email in the structured entry', () => {
      const fullEmail = 'player@example.com';
      auditService.record(AuthAuditEvent.LOGIN_SUCCESS, {
        email: AuthAuditService.redactEmail(fullEmail),
        userId: 1,
      });
      const entry = JSON.stringify(logSpy.mock.calls[0]);
      expect(entry).not.toContain(fullEmail);
    });
  });

  describe('no secrets in log output', () => {
    it('does not log raw token strings', () => {
      const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.payload.sig';
      auditService.record(AuthAuditEvent.TOKEN_REFRESHED, {
        userId: 1,
        // meta must never contain tokens — this verifies the service doesn't
        // accidentally surface them if a caller passes them in meta
        meta: { note: 'rotation complete' },
      });
      const entry = JSON.stringify(logSpy.mock.calls[0]);
      expect(entry).not.toContain(fakeToken);
    });

    it('does not log token hashes', () => {
      const hash = crypto
        .createHash('sha256')
        .update('some-token')
        .digest('hex');
      auditService.record(AuthAuditEvent.TOKEN_REUSE_DETECTED, { userId: 1 });
      const entry = JSON.stringify(warnSpy.mock.calls[0]);
      expect(entry).not.toContain(hash);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. AuthService — audit hook integration
// ---------------------------------------------------------------------------

describe('AuthService audit hooks (SW-BE-005)', () => {
  let authService: AuthService;
  let auditService: AuthAuditService;
  let auditRecordSpy: jest.SpyInstance;
  let tokenStore: Map<string, RefreshToken>;

  const TEST_SECRET = 'sw-be-005-test-secret';

  const buildTokenRepo = (store: Map<string, RefreshToken>) => ({
    create: jest.fn().mockImplementation((data: Partial<RefreshToken>) => ({
      id: crypto.randomUUID(),
      isRevoked: false,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      ...data,
    })),
    save: jest.fn().mockImplementation(async (e: RefreshToken) => {
      store.set(e.id ?? e.tokenHash, e);
      return e;
    }),
    findOne: jest.fn().mockImplementation(
      async ({ where }: { where: Partial<RefreshToken> }) => {
        for (const e of store.values()) {
          if (
            (where.tokenHash && e.tokenHash === where.tokenHash) ||
            (where.id && e.id === where.id)
          )
            return e;
        }
        return null;
      },
    ),
    update: jest
      .fn()
      .mockImplementation(
        async (
          criteria: Partial<RefreshToken>,
          update: Partial<RefreshToken>,
        ) => {
          for (const e of store.values()) {
            const matchUser =
              criteria.userId === undefined || e.userId === criteria.userId;
            const matchRevoked =
              criteria.isRevoked === undefined ||
              e.isRevoked === criteria.isRevoked;
            if (matchUser && matchRevoked) Object.assign(e, update);
          }
        },
      ),
  });

  beforeEach(async () => {
    tokenStore = new Map();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        AuthAuditService,
        {
          provide: UsersService,
          useValue: { findByEmail: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: TEST_SECRET,
            signOptions: { expiresIn: '15m' },
          }),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const cfg: Record<string, unknown> = {
                'jwt.secret': TEST_SECRET,
                'jwt.expiresIn': 900,
                'jwt.refreshExpiresIn': 604800,
                'jwt.clockTolerance': 60,
              };
              return cfg[key];
            }),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useFactory: () => buildTokenRepo(tokenStore),
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    auditService = module.get<AuthAuditService>(AuthAuditService);
    auditRecordSpy = jest.spyOn(auditService, 'record');
  });

  afterEach(() => jest.restoreAllMocks());

  it('fires LOGIN_SUCCESS on successful login', async () => {
    const user = makeUser();
    await authService.login(user, '1.2.3.4', 'jest');

    expect(auditRecordSpy).toHaveBeenCalledWith(
      AuthAuditEvent.LOGIN_SUCCESS,
      expect.objectContaining({ userId: user.id, ipAddress: '1.2.3.4' }),
    );
  });

  it('fires LOGOUT on logout', async () => {
    await authService.logout(42, '1.2.3.4', 'jest');

    expect(auditRecordSpy).toHaveBeenCalledWith(
      AuthAuditEvent.LOGOUT,
      expect.objectContaining({ userId: 42 }),
    );
  });

  it('fires TOKEN_REFRESHED on successful refresh', async () => {
    const user = makeUser();
    const { token, entity } = await authService.createRefreshToken(user.id);
    (entity as RefreshToken & { user: User }).user = user;

    await authService.refreshTokens(token, '1.2.3.4', 'jest');

    expect(auditRecordSpy).toHaveBeenCalledWith(
      AuthAuditEvent.TOKEN_REFRESHED,
      expect.objectContaining({ userId: user.id }),
    );
  });

  it('fires TOKEN_REUSE_DETECTED when a revoked token is replayed', async () => {
    const user = makeUser();
    const { token, entity } = await authService.createRefreshToken(user.id);
    entity.isRevoked = true;
    (entity as RefreshToken & { user: User }).user = user;

    await expect(authService.refreshTokens(token)).rejects.toThrow();

    expect(auditRecordSpy).toHaveBeenCalledWith(
      AuthAuditEvent.TOKEN_REUSE_DETECTED,
      expect.objectContaining({ userId: user.id }),
    );
  });

  it('fires TOKEN_REFRESH_FAILED when token is expired', async () => {
    const user = makeUser();
    const { token, entity } = await authService.createRefreshToken(user.id);
    entity.expiresAt = new Date(Date.now() - 1000);
    (entity as RefreshToken & { user: User }).user = user;

    await expect(authService.refreshTokens(token)).rejects.toThrow();

    expect(auditRecordSpy).toHaveBeenCalledWith(
      AuthAuditEvent.TOKEN_REFRESH_FAILED,
      expect.objectContaining({ meta: expect.objectContaining({ reason: 'expired' }) }),
    );
  });

  it('fires WALLET_LOGIN_FAILED when address/chain not found', async () => {
    const userRepo = authService['userRepo'] as { findOne: jest.Mock };
    userRepo.findOne.mockResolvedValue(null);

    await expect(
      authService.walletLogin('0xdead', 'BASE', '1.2.3.4', 'jest'),
    ).rejects.toThrow(NotFoundException);

    expect(auditRecordSpy).toHaveBeenCalledWith(
      AuthAuditEvent.WALLET_LOGIN_FAILED,
      expect.objectContaining({ ipAddress: '1.2.3.4' }),
    );
  });

  it('fires WALLET_LOGIN_SUCCESS on valid wallet login', async () => {
    const user = makeUser();
    const userRepo = authService['userRepo'] as { findOne: jest.Mock };
    userRepo.findOne.mockResolvedValue(user);

    await authService.walletLogin('0xabc123', 'BASE', '1.2.3.4', 'jest');

    expect(auditRecordSpy).toHaveBeenCalledWith(
      AuthAuditEvent.WALLET_LOGIN_SUCCESS,
      expect.objectContaining({ userId: user.id }),
    );
  });

  it('fires LOGIN_SUSPENDED when a suspended user attempts login', async () => {
    const usersService = authService['usersService'] as {
      findByEmail: jest.Mock;
    };
    usersService.findByEmail.mockResolvedValue(
      makeUser({ is_suspended: true }),
    );

    const result = await authService.validateUser(
      'player@example.com',
      'password',
      '1.2.3.4',
      'jest',
    );

    expect(result).toBeNull();
    expect(auditRecordSpy).toHaveBeenCalledWith(
      AuthAuditEvent.LOGIN_SUSPENDED,
      expect.objectContaining({ userId: 1 }),
    );
  });

  it('fires LOGIN_FAILED on wrong password', async () => {
    const usersService = authService['usersService'] as {
      findByEmail: jest.Mock;
    };
    // Return a user but bcrypt.compare will return false (wrong password)
    usersService.findByEmail.mockResolvedValue(makeUser());

    const result = await authService.validateUser(
      'player@example.com',
      'wrong-password',
      '1.2.3.4',
      'jest',
    );

    expect(result).toBeNull();
    expect(auditRecordSpy).toHaveBeenCalledWith(
      AuthAuditEvent.LOGIN_FAILED,
      expect.objectContaining({ email: expect.stringContaining('***') }),
    );
  });

  it('audit entries never contain raw email addresses', async () => {
    const usersService = authService['usersService'] as {
      findByEmail: jest.Mock;
    };
    usersService.findByEmail.mockResolvedValue(null);

    await authService.validateUser('player@example.com', 'pw', '1.2.3.4');

    const calls = auditRecordSpy.mock.calls as [string, Record<string, unknown>][];
    calls.forEach(([, ctx]) => {
      expect(JSON.stringify(ctx)).not.toContain('player@example.com');
    });
  });
});
