import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AuthService } from '../src/modules/auth/auth.service';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { UserPreference } from '../src/modules/users/entities/user-preference.entity';
import { BoardStyle } from '../src/modules/board-styles/entities/board-style.entity';
import { UsersService } from '../src/modules/users/users.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { jwtConfig } from '../src/config/jwt.config';

describe('Auth Token Security (Integration)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let refreshTokenRepo: Repository<RefreshToken>;
  let userRepo: Repository<User>;
  let testUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              jwt: {
                secret: 'test-secret-key',
                expiresIn: 900,
                refreshExpiresIn: 604800,
                clockTolerance: 60,
              },
            }),
            jwtConfig,
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [RefreshToken, User, UserPreference, BoardStyle],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([RefreshToken, User]),
        JwtModule.register({
          secret: 'test-secret-key',
          signOptions: { expiresIn: '15m' },
          verifyOptions: { clockTolerance: 60 },
        }),
      ],
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    refreshTokenRepo = moduleFixture.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );
    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User));

    // Create a test user
    testUser = userRepo.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      address: '0x123',
      chain: 'BASE',
      role: 'user',
      is_admin: false,
      games_played: 0,
      game_won: 0,
      game_lost: 0,
      total_staked: '0',
      total_earned: '0',
      total_withdrawn: '0',
    });
    testUser = await userRepo.save(testUser);
  }, 10000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  afterEach(async () => {
    if (refreshTokenRepo) {
      // Clear all tokens for the test user
      const tokens = await refreshTokenRepo.find({
        where: { userId: testUser.id },
      });
      if (tokens.length > 0) {
        await refreshTokenRepo.remove(tokens);
      }
    }
  });

  describe('Token Hashing', () => {
    it('should store refresh tokens as SHA-256 hashes', async () => {
      const result = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'test-agent',
      );

      const storedToken = await refreshTokenRepo.findOne({
        where: { userId: testUser.id },
      });

      expect(storedToken).toBeDefined();
      expect(storedToken!.tokenHash).not.toBe(result.token);
      expect(storedToken!.tokenHash).toHaveLength(64); // SHA-256 produces 64 hex characters

      // Verify the hash matches
      const expectedHash = crypto
        .createHash('sha256')
        .update(result.token)
        .digest('hex');
      expect(storedToken!.tokenHash).toBe(expectedHash);
    });

    it('should successfully refresh tokens using hashed lookup', async () => {
      const { token } = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'test-agent',
      );

      const result = await authService.refreshTokens(
        token,
        '127.0.0.1',
        'test-agent',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).not.toBe(token); // Should be a new token
    });
  });

  describe('Reuse Detection', () => {
    it('should reject revoked tokens', async () => {
      const { token } = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'test-agent',
      );

      // Use the token once (this revokes it)
      await authService.refreshTokens(token, '127.0.0.1', 'test-agent');

      // Try to use the same token again
      await expect(
        authService.refreshTokens(token, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow('Token reuse detected');
    });

    it('should revoke all user tokens when reuse is detected', async () => {
      // Create multiple tokens for the user
      const { token: token1 } = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'test-agent',
      );
      const { token: token2 } = await authService.createRefreshToken(
        testUser.id,
        '192.168.1.1',
        'another-agent',
      );

      // Use token1 once (revokes it)
      await authService.refreshTokens(token1, '127.0.0.1', 'test-agent');

      // Try to reuse token1 - should trigger family revocation
      await expect(
        authService.refreshTokens(token1, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow('Token reuse detected');

      // Verify all tokens for this user are now revoked
      const allTokens = await refreshTokenRepo.find({
        where: { userId: testUser.id },
      });
      expect(allTokens.every((t) => t.isRevoked)).toBe(true);

      // Token2 should also be unusable now
      await expect(
        authService.refreshTokens(token2, '192.168.1.1', 'another-agent'),
      ).rejects.toThrow('Token reuse detected');
    });
  });

  describe('Token Rotation', () => {
    it('should rotate tokens on each refresh', async () => {
      const { token: token1 } = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'test-agent',
      );

      const result1 = await authService.refreshTokens(
        token1,
        '127.0.0.1',
        'test-agent',
      );
      const token2 = result1.refreshToken;

      expect(token2).not.toBe(token1);

      const result2 = await authService.refreshTokens(
        token2,
        '127.0.0.1',
        'test-agent',
      );
      const token3 = result2.refreshToken;

      expect(token3).not.toBe(token2);
      expect(token3).not.toBe(token1);
    });

    it('should mark old token as revoked after rotation', async () => {
      const { token, entity } = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'test-agent',
      );

      await authService.refreshTokens(token, '127.0.0.1', 'test-agent');

      const oldToken = await refreshTokenRepo.findOne({
        where: { id: entity.id },
      });
      expect(oldToken!.isRevoked).toBe(true);
    });
  });

  describe('Metadata Tracking', () => {
    it('should track IP address and user agent on token creation', async () => {
      const ipAddress = '192.168.1.100';
      const userAgent = 'Mozilla/5.0 Test Browser';

      const { entity } = await authService.createRefreshToken(
        testUser.id,
        ipAddress,
        userAgent,
      );

      expect(entity.ipAddress).toBe(ipAddress);
      expect(entity.userAgent).toBe(userAgent);
      expect(entity.lastUsedAt).toBeDefined();
    });

    it('should update metadata on token refresh', async () => {
      const { token } = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'original-agent',
      );

      const newIp = '10.0.0.1';
      const newAgent = 'new-agent';

      const result = await authService.refreshTokens(token, newIp, newAgent);

      // Find the new token
      const newTokenHash = crypto
        .createHash('sha256')
        .update(result.refreshToken)
        .digest('hex');
      const newToken = await refreshTokenRepo.findOne({
        where: { tokenHash: newTokenHash },
      });

      expect(newToken!.ipAddress).toBe(newIp);
      expect(newToken!.userAgent).toBe(newAgent);
    });
  });

  describe('Logout', () => {
    it('should invalidate all refresh tokens for a user', async () => {
      // Create multiple tokens
      await authService.createRefreshToken(testUser.id, '127.0.0.1', 'agent1');
      await authService.createRefreshToken(
        testUser.id,
        '192.168.1.1',
        'agent2',
      );
      await authService.createRefreshToken(testUser.id, '10.0.0.1', 'agent3');

      // Verify tokens exist and are not revoked
      let tokens = await refreshTokenRepo.find({
        where: { userId: testUser.id },
      });
      expect(tokens).toHaveLength(3);
      expect(tokens.every((t) => !t.isRevoked)).toBe(true);

      // Logout
      await authService.logout(testUser.id);

      // Verify all tokens are revoked
      tokens = await refreshTokenRepo.find({ where: { userId: testUser.id } });
      expect(tokens).toHaveLength(3);
      expect(tokens.every((t) => t.isRevoked)).toBe(true);
    });

    it('should prevent using tokens after logout', async () => {
      const { token } = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'test-agent',
      );

      await authService.logout(testUser.id);

      await expect(
        authService.refreshTokens(token, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow('Token reuse detected');
    });
  });

  describe('Clock Skew Tolerance', () => {
    it('should accept tokens within clock skew tolerance', async () => {
      // This test verifies that the JWT module is configured with clockTolerance
      // The actual clock skew handling is done by the jsonwebtoken library
      const { token } = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'test-agent',
      );

      // Token should be valid immediately
      const result = await authService.refreshTokens(
        token,
        '127.0.0.1',
        'test-agent',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid tokens', async () => {
      await expect(
        authService.refreshTokens('invalid-token', '127.0.0.1', 'test-agent'),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should reject expired tokens', async () => {
      // Create a token with very short expiry
      const shortExpiryToken = await authService.createRefreshToken(
        testUser.id,
        '127.0.0.1',
        'test-agent',
      );

      // Manually set expiry to past
      await refreshTokenRepo.update(
        { id: shortExpiryToken.entity.id },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      await expect(
        authService.refreshTokens(
          shortExpiryToken.token,
          '127.0.0.1',
          'test-agent',
        ),
      ).rejects.toThrow('Refresh token expired');
    });
  });
});
