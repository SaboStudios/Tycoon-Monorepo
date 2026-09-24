import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { WaitlistAdminController } from './waitlist-admin.controller';
import { WaitlistService } from './waitlist.service';
import { AdminLogsService } from '../admin-logs/admin-logs.service';
import { RedisService } from '../redis/redis.service';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';
import { Waitlist } from './entities/waitlist.entity';

describe('WaitlistAdminController - Update/Delete', () => {
  let controller: WaitlistAdminController;
  let waitlistService: WaitlistService;
  let adminLogsService: AdminLogsService;

  const mockWaitlistService = {
    update: jest.fn(),
    softDelete: jest.fn(),
    hardDelete: jest.fn(),
  };

  const mockAdminLogsService = {
    createLog: jest.fn(),
  };

  const mockRedisService = {
    incrementRateLimit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaitlistAdminController],
      providers: [
        { provide: WaitlistService, useValue: mockWaitlistService },
        { provide: AdminLogsService, useValue: mockAdminLogsService },
        { provide: RedisService, useValue: mockRedisService },
        Reflector,
      ],
    }).compile();

    controller = module.get<WaitlistAdminController>(WaitlistAdminController);
    waitlistService = module.get<WaitlistService>(WaitlistService);
    adminLogsService = module.get<AdminLogsService>(AdminLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('update', () => {
    it('should update a waitlist entry and log the action', async () => {
      const id = 1;
      const updateDto: UpdateWaitlistDto = {
        email_address: 'newemail@example.com',
      };
      const mockRequest = {
        user: { id: 10 },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      } as any;

      const updatedEntry: Waitlist = {
        id,
        wallet_address: 'GXXX',
        email_address: 'newemail@example.com',
        telegram_username: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      mockWaitlistService.update.mockResolvedValue(updatedEntry);

      const result = await controller.update(id, updateDto, mockRequest);

      expect(waitlistService.update).toHaveBeenCalledWith(id, updateDto);
      expect(adminLogsService.createLog).toHaveBeenCalledWith(
        10,
        'waitlist:update',
        id,
        { changes: updateDto },
        mockRequest,
      );
      expect(result).toEqual(updatedEntry);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a waitlist entry and log the action', async () => {
      const id = 1;
      const mockRequest = {
        user: { id: 10 },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      } as any;

      mockWaitlistService.softDelete.mockResolvedValue(undefined);

      await controller.softDelete(id, mockRequest);

      expect(waitlistService.softDelete).toHaveBeenCalledWith(id);
      expect(adminLogsService.createLog).toHaveBeenCalledWith(
        10,
        'waitlist:soft_delete',
        id,
        null,
        mockRequest,
      );
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a waitlist entry and log the action', async () => {
      const id = 1;
      const mockRequest = {
        user: { id: 10 },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      } as any;

      mockWaitlistService.hardDelete.mockResolvedValue(undefined);

      await controller.hardDelete(id, mockRequest);

      expect(waitlistService.hardDelete).toHaveBeenCalledWith(id);
      expect(adminLogsService.createLog).toHaveBeenCalledWith(
        10,
        'waitlist:hard_delete',
        id,
        null,
        mockRequest,
      );
    });
  });
});
