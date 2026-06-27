import { Test, TestingModule } from '@nestjs/testing';
import { AdminAnalyticsObservabilityService } from './admin-analytics-observability.service';
import { LoggerService } from '../../common/logger/logger.service';

describe('AdminAnalyticsObservabilityService', () => {
  let service: AdminAnalyticsObservabilityService;
  const mockLoggerService = {
    debug: jest.fn(),
    logWithMeta: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsObservabilityService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<AdminAnalyticsObservabilityService>(
      AdminAnalyticsObservabilityService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record analytics request metrics and log debug details', async () => {
    service.recordRequest('dashboard', true, 120);

    const metrics = await service.registry.metrics();

    expect(metrics).toContain('tycoon_admin_analytics_requests_total');
    expect(metrics).toContain('tycoon_admin_analytics_request_duration_seconds');
    expect(mockLoggerService.debug).toHaveBeenCalledWith(
      'Admin analytics request completed: dashboard (success)',
      'AdminAnalyticsObservability',
    );
  });

  it('should log endpoint metadata with custom message', () => {
    service.logEndpoint('users_total', 'Request completed', { userCount: 5 });

    expect(mockLoggerService.logWithMeta).toHaveBeenCalledWith('info',
      'Request completed',
      expect.objectContaining({
        endpoint: 'users_total',
        userCount: 5,
      }),
    );
  });
});
