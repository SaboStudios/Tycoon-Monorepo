import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistAdminController } from './waitlist-admin.controller';
import { WaitlistService } from './waitlist.service';
import { BadRequestException } from '@nestjs/common';
import { RedisRateLimitGuard } from '../../common/guards/redis-rate-limit.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

describe('WaitlistAdminController – bulkImport', () => {
  let controller: WaitlistAdminController;

  const mockWaitlistService = {
    create: jest.fn(),
    findAll: jest.fn(),
    bulkImport: jest.fn(),
  };

  // Stub guards so NestJS does not try to resolve their dependencies
  const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

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
      .overrideGuard(RedisRateLimitGuard)
      .useValue(mockGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<WaitlistAdminController>(WaitlistAdminController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call service.bulkImport with the file buffer', async () => {
    const mockFile = {
      buffer: Buffer.from('email_address\nuser@example.com\n'),
      originalname: 'test.csv',
      mimetype: 'text/csv',
    } as Express.Multer.File;

    const expectedResult = {
      message: 'Bulk import completed.',
      data: {
        totalRows: 1,
        importedCount: 1,
        duplicateCount: 0,
        errorCount: 0,
        errors: [],
      },
    };

    mockWaitlistService.bulkImport.mockResolvedValue(expectedResult);

    const result = await controller.bulkImport(mockFile);

    expect(mockWaitlistService.bulkImport).toHaveBeenCalledWith(
      mockFile.buffer,
    );
    expect(result).toEqual(expectedResult);
  });

  it('should throw BadRequestException when no file is uploaded', async () => {
    await expect(
      controller.bulkImport(undefined as unknown as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
  });
});
