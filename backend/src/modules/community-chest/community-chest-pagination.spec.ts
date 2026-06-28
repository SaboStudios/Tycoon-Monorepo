import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityChestService } from './community-chest.service';
import { CommunityChest } from './entities/community-chest.entity';
import { CommunityChestErrorMapperService } from './community-chest-error-mapper.service';
import {
  GetCommunityChestListDto,
  CommunityChestSortBy,
  SortOrder,
} from './dto/get-community-chest-list.dto';

jest.mock('../../common/crypto-secure-random', () => ({
  secureRandomInt: jest.fn(() => 0),
}));

const mockCards = [
  { id: 1, instruction: 'Advance to Go', type: 'reward', amount: 200 },
  { id: 2, instruction: 'Go to Jail', type: 'penalty', amount: 0 },
  { id: 3, instruction: 'Pay fine', type: 'penalty', amount: 50 },
];

describe('CommunityChestService — Pagination & Stable Sorting', () => {
  let service: CommunityChestService;
  let mockQueryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([mockCards, 3]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityChestService,
        CommunityChestErrorMapperService,
        {
          provide: getRepositoryToken(CommunityChest),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            count: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CommunityChestService>(CommunityChestService);
  });

  describe('pagination', () => {
    it('should return paginated response with meta', async () => {
      const query: GetCommunityChestListDto = { page: 1, limit: 10 };

      const result = await service.findAll(query);

      expect(result.data).toEqual(mockCards);
      expect(result.meta).toBeDefined();
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalItems).toBe(3);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it('should apply skip and take based on page and limit', async () => {
      const query: GetCommunityChestListDto = { page: 2, limit: 2 };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [mockCards[2]],
        3,
      ]);

      const result = await service.findAll(query);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(2);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(2);
      expect(result.meta.page).toBe(2);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('should clamp limit to max 100', async () => {
      const query: GetCommunityChestListDto = { page: 1, limit: 500 };

      await service.findAll(query);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
    });

    it('should clamp limit minimum to 1', async () => {
      const query: GetCommunityChestListDto = { page: 1, limit: 0 };

      await service.findAll(query);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(1);
    });

    it('should default page to 1 and limit to 10', async () => {
      const query: GetCommunityChestListDto = {};

      await service.findAll(query);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should calculate totalPages correctly', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockCards.slice(0, 2),
        5,
      ]);
      const query: GetCommunityChestListDto = { page: 1, limit: 2 };

      const result = await service.findAll(query);

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
    });
  });

  describe('stable sorting', () => {
    it('should add secondary sort by id when sorting by non-id column', async () => {
      const query: GetCommunityChestListDto = {
        sortBy: CommunityChestSortBy.CREATED_AT,
        sortOrder: SortOrder.DESC,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.createdAt',
        'DESC',
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'community_chest.id',
        'DESC',
      );
    });

    it('should not add secondary sort when sorting by id', async () => {
      const query: GetCommunityChestListDto = {
        sortBy: CommunityChestSortBy.ID,
        sortOrder: SortOrder.ASC,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.id',
        'ASC',
      );
      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });

    it('should use stable sort with type column', async () => {
      const query: GetCommunityChestListDto = {
        sortBy: CommunityChestSortBy.TYPE,
        sortOrder: SortOrder.ASC,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.type',
        'ASC',
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'community_chest.id',
        'ASC',
      );
    });

    it('should use stable sort with amount column', async () => {
      const query: GetCommunityChestListDto = {
        sortBy: CommunityChestSortBy.AMOUNT,
        sortOrder: SortOrder.DESC,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'community_chest.id',
        'DESC',
      );
    });

    it('should default invalid sortBy to id', async () => {
      const query: GetCommunityChestListDto = {
        sortBy: 'badField' as CommunityChestSortBy,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.id',
        'ASC',
      );
      expect(mockQueryBuilder.addOrderBy).not.toHaveBeenCalled();
    });
  });

  describe('filter + pagination combined', () => {
    it('should apply type filter with pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        [mockCards[0]],
        1,
      ]);
      const query: GetCommunityChestListDto = {
        type: 'reward',
        page: 1,
        limit: 5,
      };

      const result = await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'community_chest.type = :type',
        { type: 'reward' },
      );
      expect(result.meta.totalItems).toBe(1);
    });

    it('should combine type filter with stable sorting and pagination', async () => {
      const query: GetCommunityChestListDto = {
        type: 'penalty',
        sortBy: CommunityChestSortBy.AMOUNT,
        sortOrder: SortOrder.DESC,
        page: 1,
        limit: 10,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.amount',
        'DESC',
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'community_chest.id',
        'DESC',
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });
});
