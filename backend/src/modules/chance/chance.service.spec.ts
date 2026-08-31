import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { ChanceService } from './chance.service';
import { ChanceObservabilityService } from './chance-observability.service';
import { Chance } from './entities/chance.entity';
import { ChanceType } from './enums/chance-type.enum';
import { LoggerService } from '../../common/logger/logger.service';
import { PaginationService } from '../../common';
import { RANDOM_PROVIDER, SeededRandomProvider } from '../../common/random-provider';

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

  /** Helper: build module with optional seed (default 0 → always picks index 0) */
  async function buildModule(seed = 0): Promise<TestingModule> {
    logger = { logWithMeta: jest.fn() };
    return Test.createTestingModule({
      providers: [
        ChanceService,
        ChanceObservabilityService,
        { provide: getRepositoryToken(Chance), useValue: mockChanceRepository },
        { provide: LoggerService, useValue: logger },
        { provide: RANDOM_PROVIDER, useValue: new SeededRandomProvider(seed) },
        {
          provide: PaginationService,
          useValue: {
            paginate: jest.fn().mockResolvedValue({
              data: [],
              meta: {
                page: 1,
                limit: 10,
                totalItems: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            }),
          },
        },
      ],
    }).compile();
  }

  beforeEach(async () => {
    const module = await buildModule(0);
    service = module.get<ChanceService>(ChanceService);
    observability = module.get<ChanceObservabilityService>(ChanceObservabilityService);
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

  describe('seedable RNG determinism', () => {
    it('SeededRandomProvider always produces the same sequence for a given seed', async () => {
      const rng1 = new SeededRandomProvider(42);
      const rng2 = new SeededRandomProvider(42);
      const results1 = Array.from({ length: 5 }, () => rng1.nextInt(100));
      const results2 = Array.from({ length: 5 }, () => rng2.nextInt(100));
      expect(results1).toEqual(results2);
    });

    it('different seeds produce different sequences', () => {
      const rng1 = new SeededRandomProvider(1);
      const rng2 = new SeededRandomProvider(2);
      const r1 = Array.from({ length: 10 }, () => rng1.nextInt(1000));
      const r2 = Array.from({ length: 10 }, () => rng2.nextInt(1000));
      expect(r1).not.toEqual(r2);
    });

    it('drawCard uses the injected RNG — result is deterministic for a fixed seed', async () => {
      // Build two identical services with the same seed
      const mod1 = await buildModule(7);
      const mod2 = await buildModule(7);
      const svc1 = mod1.get<ChanceService>(ChanceService);
      const svc2 = mod2.get<ChanceService>(ChanceService);

      const cards: Chance[] = [
        { id: 1, type: ChanceType.REWARD, instruction: 'A' } as Chance,
        { id: 2, type: ChanceType.PENALTY, instruction: 'B' } as Chance,
        { id: 3, type: ChanceType.MOVE, instruction: 'C' } as Chance,
      ];

      mockChanceRepository.count.mockResolvedValue(3);
      // find returns the card at whatever skip the RNG picks
      mockChanceRepository.find.mockImplementation(({ skip }: any) =>
        Promise.resolve([cards[skip % cards.length]]),
      );

      const draw1 = await svc1.drawCard();
      const draw2 = await svc2.drawCard();
      expect(draw1.id).toBe(draw2.id);
    });
  });
});
