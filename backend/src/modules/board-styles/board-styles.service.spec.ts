import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BoardStylesService } from './board-styles.service';
import { BoardStyle } from './entities/board-style.entity';
import {
  PaginationService,
  SortOrder,
  PAGINATION_MAX_LIMIT,
} from '../../common';
import { RedisService } from '../redis/redis.service';

describe('BoardStylesService', () => {
  let service: BoardStylesService;

  const mockBoardStyleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPaginationService = {
    paginate: jest.fn(),
  };

  const mockRedisService = {
    delByPattern: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardStylesService,
        {
          provide: getRepositoryToken(BoardStyle),
          useValue: mockBoardStyleRepository,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<BoardStylesService>(BoardStylesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll pagination', () => {
    const buildQueryBuilder = () => ({
      andWhere: jest.fn().mockReturnThis(),
    });

    it('returns the first page slice', async () => {
      const mockQb = buildQueryBuilder();
      mockBoardStyleRepository.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginate.mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        meta: {
          page: 1,
          limit: 2,
          totalItems: 5,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      });

      const result = await service.findAll({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.page).toBe(1);
      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQb,
        expect.objectContaining({ page: 1, limit: 2 }),
        ['name', 'description'],
        expect.arrayContaining(['created_at', 'id']),
      );
    });

    it('returns the second page slice', async () => {
      const mockQb = buildQueryBuilder();
      mockBoardStyleRepository.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginate.mockResolvedValue({
        data: [{ id: 3 }, { id: 4 }],
        meta: {
          page: 2,
          limit: 2,
          totalItems: 5,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      });

      const result = await service.findAll({ page: 2, limit: 2 });

      expect(result.meta.page).toBe(2);
      expect(result.data.every((item) => item.id >= 3)).toBe(true);
      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQb,
        expect.objectContaining({ page: 2, limit: 2 }),
        ['name', 'description'],
        expect.any(Array),
      );
    });

    it(`caps limit at ${PAGINATION_MAX_LIMIT} via PaginationService`, async () => {
      const mockQb = buildQueryBuilder();
      mockBoardStyleRepository.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginate.mockResolvedValue({
        data: [],
        meta: {
          page: 1,
          limit: PAGINATION_MAX_LIMIT,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      await service.findAll({ page: 1, limit: 9999 });

      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQb,
        expect.objectContaining({ limit: 9999 }),
        ['name', 'description'],
        expect.any(Array),
      );
    });

    it('uses created_at DESC with id tiebreaker for stable sort across pages', async () => {
      const mockQb = buildQueryBuilder();
      mockBoardStyleRepository.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginate.mockResolvedValue({
        data: [],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      await service.findAll({ page: 1, limit: 10 });

      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQb,
        expect.objectContaining({
          sortBy: 'created_at',
          sortOrder: SortOrder.DESC,
        }),
        ['name', 'description'],
        expect.arrayContaining(['id', 'created_at']),
      );
    });

    it('applies is_premium filter when provided', async () => {
      const mockQb = buildQueryBuilder();
      mockBoardStyleRepository.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginate.mockResolvedValue({
        data: [],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      await service.findAll({ page: 1, limit: 10, is_premium: true });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'board_style.is_premium = :isPremium',
        { isPremium: true },
      );
    });
  });
});
