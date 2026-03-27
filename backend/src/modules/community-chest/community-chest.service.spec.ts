import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityChestService } from './community-chest.service';
import { CommunityChest } from './entities/community-chest.entity';
import {
  GetCommunityChestListDto,
  CommunityChestSortBy,
  SortOrder,
} from './dto/get-community-chest-list.dto';

jest.mock('../../common/crypto-secure-random', () => ({
  secureRandomInt: jest.fn(() => 0),
}));

const mockCommunityChest = {
  id: 1,
  instruction: 'Advance to Go',
  type: 'advance_to_go',
  amount: 0,
  position: 0,
  extra: null,
};

const mockCommunityChest2 = {
  id: 2,
  instruction: 'Go to Jail',
  type: 'go_to_jail',
  amount: 0,
  position: 0,
  extra: null,
};

describe('CommunityChestService', () => {
  let service: CommunityChestService;
  let mockCreateQueryBuilder: jest.Mock;
  let mockQueryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
    getOne: jest.Mock;
    getMany: jest.Mock;
  };
  let mockCount: jest.Mock;
  let mockFind: jest.Mock;

  beforeEach(async () => {
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCommunityChest),
      getMany: jest.fn().mockResolvedValue([mockCommunityChest]),
    };

    mockCreateQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
    mockCount = jest.fn().mockResolvedValue(2);
    mockFind = jest.fn().mockResolvedValue([mockCommunityChest]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityChestService,
        {
          provide: getRepositoryToken(CommunityChest),
          useValue: {
            createQueryBuilder: mockCreateQueryBuilder,
            count: mockCount,
            find: mockFind,
          },
        },
      ],
    }).compile();

    service = module.get<CommunityChestService>(CommunityChestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('drawCard', () => {
    it('should return a random community chest card', async () => {
      const result = await service.drawCard();
      expect(result).toEqual(mockCommunityChest);
      expect(mockCount).toHaveBeenCalled();
      expect(mockFind).toHaveBeenCalledWith({
        order: { id: 'ASC' },
        skip: 0,
        take: 1,
      });
    });

    it('should return null when no cards exist', async () => {
      mockCount.mockResolvedValueOnce(0);
      const result = await service.drawCard();
      expect(result).toBeNull();
      expect(mockFind).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all community chest cards with default sorting', async () => {
      const query: GetCommunityChestListDto = {};
      mockQueryBuilder.getMany.mockResolvedValue([
        mockCommunityChest,
        mockCommunityChest2,
      ]);

      const result = await service.findAll(query);

      expect(result).toEqual([mockCommunityChest, mockCommunityChest2]);
      expect(mockCreateQueryBuilder).toHaveBeenCalledWith('community_chest');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.id',
        'ASC',
      );
    });

    it('should sort by specified field in descending order', async () => {
      const query: GetCommunityChestListDto = {
        sortBy: CommunityChestSortBy.CREATED_AT,
        sortOrder: SortOrder.DESC,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.createdAt',
        'DESC',
      );
    });

    it('should filter by type when provided', async () => {
      const query: GetCommunityChestListDto = {
        type: 'advance_to_go',
      };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'community_chest.type = :type',
        { type: 'advance_to_go' },
      );
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
    });

    it('should handle invalid sortBy gracefully by defaulting to id', async () => {
      const query: GetCommunityChestListDto = {
        sortBy: 'invalidSort' as CommunityChestSortBy,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.id',
        'ASC',
      );
    });

    it('should sort by type field', async () => {
      const query: GetCommunityChestListDto = {
        sortBy: CommunityChestSortBy.TYPE,
        sortOrder: SortOrder.ASC,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.type',
        'ASC',
      );
    });

    it('should combine type filter with custom sorting', async () => {
      const query: GetCommunityChestListDto = {
        type: 'go_to_jail',
        sortBy: CommunityChestSortBy.AMOUNT,
        sortOrder: SortOrder.DESC,
      };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'community_chest.type = :type',
        { type: 'go_to_jail' },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'community_chest.amount',
        'DESC',
      );
    });
  });
});
