import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaitlistService } from './waitlist.service';
import { Waitlist } from './entities/waitlist.entity';
import { PaginationService, SortOrder } from '../../common';
import { WaitlistPaginationDto } from './dto/waitlist-pagination.dto';

describe('WaitlistService', () => {
  let service: WaitlistService;

  const mockWaitlistRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPaginationService = {
    paginate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        {
          provide: getRepositoryToken(Waitlist),
          useValue: mockWaitlistRepository,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllAdmin', () => {
    it('should call paginationService.paginate with correct query', async () => {
      const dto: WaitlistPaginationDto = {
        page: 1,
        limit: 10,
        wallet: '0x123',
      };

      const mockQueryBuilder: any = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };

      mockWaitlistRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );
      mockPaginationService.paginate.mockResolvedValue({ data: [], meta: {} });

      await service.findAllAdmin(dto);

      expect(mockWaitlistRepository.createQueryBuilder).toHaveBeenCalledWith(
        'waitlist',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'waitlist.wallet_address ILIKE :wallet',
        { wallet: '%0x123%' },
      );
      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQueryBuilder,
        dto,
      );
    });

    it('should apply sorting correctly', async () => {
      const dto: WaitlistPaginationDto = {
        sortBy: 'email',
        sortOrder: SortOrder.DESC,
      };

      const mockQueryBuilder: any = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };

      mockWaitlistRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );
      mockPaginationService.paginate.mockResolvedValue({ data: [], meta: {} });

      await service.findAllAdmin(dto);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'waitlist.email_address',
        SortOrder.DESC,
      );
    });
  });

  describe('getStats', () => {
    it('should return waitlist statistics', async () => {
      mockWaitlistRepository.count.mockResolvedValueOnce(100); // total
      mockWaitlistRepository.count.mockResolvedValueOnce(60); // withWallet
      mockWaitlistRepository.count.mockResolvedValueOnce(40); // withEmail

      const stats = await service.getStats();

      expect(stats).toEqual({
        totalItems: 100,
        withWallet: 60,
        withEmail: 40,
      });
      expect(mockWaitlistRepository.count).toHaveBeenCalledTimes(3);
    });
  });

  describe('exportWaitlist', () => {
    it('should export waitlist as CSV', async () => {
      const dto = { format: 'csv' };
      const mockRes = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        pipe: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
      } as any;

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        stream: jest.fn().mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            await Promise.resolve();
            yield {
              waitlist_id: 1,
              waitlist_wallet_address: '0x123',
              waitlist_email_address: 'test@example.com',
              waitlist_telegram_username: 'test',
              waitlist_created_at: new Date(),
            };
          },
        }),
      } as any;

      mockWaitlistRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.exportWaitlist(dto as any, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockQueryBuilder.stream).toHaveBeenCalled();
    });
  });
});
