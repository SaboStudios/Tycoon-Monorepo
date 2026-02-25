import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistAdminController } from './waitlist-admin.controller';
import { WaitlistService } from './waitlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RedisRateLimitGuard } from '../../common/guards/redis-rate-limit.guard';
import { WaitlistPaginationDto } from './dto/waitlist-pagination.dto';

describe('WaitlistAdminController', () => {
  let controller: WaitlistAdminController;
  let service: WaitlistService;

  const mockWaitlistService = {
    findAllAdmin: jest.fn(),
    getStats: jest.fn(),
    exportWaitlist: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaitlistAdminController],
      providers: [
        {
          provide: WaitlistService,
          useValue: mockWaitlistService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RedisRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WaitlistAdminController>(WaitlistAdminController);
    service = module.get<WaitlistService>(WaitlistService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated results with stats', async () => {
      const dto: WaitlistPaginationDto = { page: 1, limit: 10 };
      const mockPaginatedResponse = {
        data: [],
        meta: { totalItems: 0 },
      };
      const mockStats = { totalItems: 10, withWallet: 5, withEmail: 5 };

      mockWaitlistService.findAllAdmin.mockResolvedValue(mockPaginatedResponse);
      mockWaitlistService.getStats.mockResolvedValue(mockStats);

      const result = await controller.findAll(dto);

      expect(result).toEqual({
        ...mockPaginatedResponse,
        stats: mockStats,
      });
      expect(service.findAllAdmin).toHaveBeenCalledWith(dto);
      expect(service.getStats).toHaveBeenCalled();
    });
  });

  describe('export', () => {
    it('should call service.exportWaitlist', async () => {
      const dto = { format: 'csv' };
      const mockRes = {};

      await controller.export(dto as any, mockRes as any);

      expect(mockWaitlistService.exportWaitlist).toHaveBeenCalledWith(
        dto,
        mockRes,
      );
    });
  });
});
