import { Test, TestingModule } from '@nestjs/testing';
import { ChanceController } from './chance.controller';
import { ChanceService } from './chance.service';
import { Chance } from './entities/chance.entity';
import { ListChancesQueryDto } from './dto/list-chances-query.dto';
import { ChanceType } from './enums/chance-type.enum';

describe('ChanceController', () => {
  let controller: ChanceController;
  let service: ChanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChanceController],
      providers: [
        {
          provide: ChanceService,
          useValue: {
            findAll: jest.fn(),
            drawCard: jest.fn(),
            createChance: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChanceController>(ChanceController);
    service = module.get<ChanceService>(ChanceService);
  });

  describe('getAllChances', () => {
    it('should return paginated chances', async () => {
      const mockChances = [
        {
          id: 1,
          instruction: 'Go to jail',
          type: ChanceType.MOVE,
          amount: null,
          position: 10,
          extra: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const mockResponse = {
        data: mockChances,
        meta: {
          page: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(mockResponse);

      const queryDto = new ListChancesQueryDto();
      const result = await controller.getAllChances(queryDto);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(queryDto);
    });

    it('should pass query parameters to service', async () => {
      const mockResponse = {
        data: [],
        meta: {
          page: 2,
          limit: 20,
          totalItems: 100,
          totalPages: 5,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(mockResponse);

      const queryDto = new ListChancesQueryDto();
      queryDto.page = 2;
      queryDto.limit = 20;

      await controller.getAllChances(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 20,
        }),
      );
    });

    it('should include pagination metadata in response', async () => {
      const mockResponse = {
        data: [],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 50,
          totalPages: 5,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(mockResponse);

      const queryDto = new ListChancesQueryDto();
      const result = await controller.getAllChances(queryDto);

      expect(result.meta).toBeDefined();
      expect(result.meta.totalItems).toBe(50);
      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(false);
    });
  });
});
