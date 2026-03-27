import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminLogsService } from './admin-logs.service';
import { AdminLog } from './entities/admin-log.entity';
import { PaginationService } from '../../common';
import { repositoryMockFactory } from '../../../test/mocks/database.mock';

describe('AdminLogsService', () => {
  let service: AdminLogsService;
  let repositoryMock: any;
  let paginationService: PaginationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminLogsService,
        {
          provide: getRepositoryToken(AdminLog),
          useFactory: repositoryMockFactory,
        },
        {
          provide: PaginationService,
          useValue: {
            paginate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminLogsService>(AdminLogsService);
    repositoryMock = module.get(getRepositoryToken(AdminLog));
    paginationService = module.get<PaginationService>(PaginationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should apply filters and call paginate', async () => {
      const queryDto = {
        adminId: 1,
        action: 'test_action',
        startDate: '2023-01-01',
        endDate: '2023-01-31',
      };

      const queryBuilderMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      repositoryMock.createQueryBuilder.mockReturnValue(queryBuilderMock);

      await service.findAll(queryDto as any);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('log.adminId = :adminId', { adminId: 1 });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('log.action = :action', { action: 'test_action' });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('log.createdAt >= :startDate', { startDate: '2023-01-01' });
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('log.createdAt <= :endDate', { endDate: '2023-01-31' });
      expect(paginationService.paginate).toHaveBeenCalled();
    });

    it('should apply cursor pagination if provided', async () => {
      const queryDto = { cursor: '100' };
      const queryBuilderMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      repositoryMock.createQueryBuilder.mockReturnValue(queryBuilderMock);

      await service.findAll(queryDto as any);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('log.id < :cursor', { cursor: '100' });
    });
  });

  describe('exportLogs', () => {
    it('should stream data to the response', async () => {
      const queryDto = { action: 'export' };
      const resMock = {
        setHeader: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };
      const streamMock = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn()
            .mockResolvedValueOnce({ value: { log_id: 1, log_action: 'export' }, done: false })
            .mockResolvedValueOnce({ done: true }),
        }),
      };
      const queryBuilderMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        stream: jest.fn().mockResolvedValue(streamMock),
      };
      repositoryMock.createQueryBuilder.mockReturnValue(queryBuilderMock);

      await service.exportLogs(queryDto as any, resMock as any);

      expect(resMock.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(queryBuilderMock.stream).toHaveBeenCalled();
    });
  });
});
