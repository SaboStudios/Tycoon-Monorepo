import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { ChanceService } from './chance.service';
import { ChanceObservabilityService } from './chance-observability.service';
import { Chance } from './entities/chance.entity';
import { ChanceType } from './enums/chance-type.enum';
import { LoggerService } from '../../common/logger/logger.service';

describe('ChanceService observability (#880)', () => {
  let service: ChanceService;
  let observability: ChanceObservabilityService;
  let logger: jest.Mocked<Pick<LoggerService, 'logWithMeta'>>;

  const mockChanceRepository = {
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    logger = {
      logWithMeta: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChanceService,
        ChanceObservabilityService,
        {
          provide: getRepositoryToken(Chance),
          useValue: mockChanceRepository,
        },
        {
          provide: LoggerService,
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get<ChanceService>(ChanceService);
    observability = module.get<ChanceObservabilityService>(
      ChanceObservabilityService,
    );
    jest.clearAllMocks();
  });

  it('logs the roll action on successful draw', async () => {
    const card = {
      id: 7,
      type: ChanceType.REWARD,
      instruction: 'Collect $100',
    } as Chance;

    mockChanceRepository.count.mockResolvedValue(1);
    mockChanceRepository.find.mockResolvedValue([card]);

    await service.drawCard();

    expect(logger.logWithMeta).toHaveBeenCalledWith(
      'info',
      'chance.roll',
      expect.objectContaining({ action: 'chance.roll', input: {} }),
    );
    expect(logger.logWithMeta).toHaveBeenCalledWith(
      'info',
      'chance.roll',
      expect.objectContaining({
        action: 'chance.roll',
        result: 'success',
        outcome: ChanceType.REWARD,
      }),
    );
  });

  it('logs errors on failed roll', async () => {
    mockChanceRepository.count.mockResolvedValue(0);

    await expect(service.drawCard()).rejects.toThrow(BadRequestException);

    expect(logger.logWithMeta).toHaveBeenCalledWith(
      'error',
      'chance.roll',
      expect.objectContaining({
        action: 'chance.roll',
        error: 'No chance cards available',
      }),
    );
  });

  it('increments chance_rolls_total with the correct outcome label', async () => {
    const card = {
      id: 3,
      type: ChanceType.PENALTY,
      instruction: 'Pay $50',
    } as Chance;

    mockChanceRepository.count.mockResolvedValue(2);
    mockChanceRepository.find.mockResolvedValue([card]);

    const incSpy = jest.spyOn(
      (observability as any).chanceRollsTotal,
      'inc',
    );

    await service.drawCard();

    expect(incSpy).toHaveBeenCalledWith({ outcome: ChanceType.PENALTY });
  });
});
