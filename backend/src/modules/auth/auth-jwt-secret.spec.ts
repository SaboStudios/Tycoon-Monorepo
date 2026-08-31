import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { validationSchema } from '../../config/env.validation';
import { jwtConfig } from '../../config/jwt.config';

describe('JWT Secret Validation', () => {
  describe('when JWT_SECRET is not set in non-test environments', () => {
    it('should throw error during bootstrap for production environment', async () => {
      const originalJwtSecret = process.env.JWT_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        delete process.env.JWT_SECRET;
        process.env.NODE_ENV = 'production';

        const moduleRef = Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: false,
              load: [jwtConfig],
              validationSchema,
              validationOptions: { abortEarly: false },
              expandVariables: false,
              cache: false,
            }),
          ],
        });

        const error = await expect(moduleRef.compile()).rejects.toThrow();
        expect(error).toMatchObject(
          expect.objectContaining({
            message: expect.stringMatching(/JWT_SECRET|required/i),
          }),
        );
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalJwtSecret) {
          process.env.JWT_SECRET = originalJwtSecret;
        }
      }
    });

    it('should throw error during bootstrap for staging environment', async () => {
      const originalJwtSecret = process.env.JWT_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        delete process.env.JWT_SECRET;
        process.env.NODE_ENV = 'staging';

        const moduleRef = Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: false,
              load: [jwtConfig],
              validationSchema,
              validationOptions: { abortEarly: false },
              expandVariables: false,
              cache: false,
            }),
          ],
        });

        const error = await expect(moduleRef.compile()).rejects.toThrow();
        expect(error).toMatchObject(
          expect.objectContaining({
            message: expect.stringMatching(/JWT_SECRET|required/i),
          }),
        );
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalJwtSecret) {
          process.env.JWT_SECRET = originalJwtSecret;
        }
      }
    });
  });

  describe('when JWT_SECRET is properly set', () => {
    it('should initialize JwtModule successfully with explicit secret', async () => {
      process.env.JWT_SECRET = 'test-secret-32-characters-minimum-length-12345';
      process.env.NODE_ENV = 'test';

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: false,
            load: [jwtConfig],
            validationSchema,
            validationOptions: { abortEarly: false },
            expandVariables: false,
            cache: false,
          }),
          JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const secret = configService.get<string>('jwt.secret');
              if (!secret) {
                throw new Error('JWT_SECRET must be set in environment variables');
              }
              return { secret };
            },
          }),
        ],
      }).compile();

      expect(module).toBeDefined();
      const configService = module.get<ConfigService>(ConfigService);
      const secret = configService.get<string>('jwt.secret');
      expect(secret).toBe('test-secret-32-characters-minimum-length-12345');
      expect(secret).not.toBe('default-secret');
    });
  });

  describe('literal default-secret string should not appear in runtime', () => {
    it('should not fall back to default-secret in jwt.config', () => {
      process.env.JWT_SECRET = 'test-secret-32-characters-minimum-length-12345';
      process.env.NODE_ENV = 'test';

      const config = jwtConfig();
      expect(config.secret).not.toBe('default-secret');
      expect(config.secret).not.toContain('default-secret');
    });
  });
});
