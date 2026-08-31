import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailProviderFactory } from './email-provider.factory';
import { NoOpEmailProvider } from './noop.provider';

describe('EmailProviderFactory', () => {
  let factory: EmailProviderFactory;
  let configService: Partial<ConfigService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'email.provider': 'noop',
          'app.nodeEnv': 'development',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderFactory,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    factory = module.get<EmailProviderFactory>(EmailProviderFactory);
  });

  it('should create NoOpEmailProvider for development', () => {
    const provider = factory.createProvider();
    expect(provider).toBeInstanceOf(NoOpEmailProvider);
  });

  it('should throw error in production when provider is noop', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'email.provider') return 'noop';
      if (key === 'app.nodeEnv') return 'production';
      return undefined;
    });

    expect(() => factory.createProvider()).toThrow(
      expect.stringMatching(/EMAIL_PROVIDER.*production/i),
    );
  });

  it('should throw error for unknown provider type', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'email.provider') return 'unknown-provider';
      if (key === 'app.nodeEnv') return 'development';
      return undefined;
    });

    expect(() => factory.createProvider()).toThrow(
      expect.stringMatching(/Unknown EMAIL_PROVIDER/i),
    );
  });
});
