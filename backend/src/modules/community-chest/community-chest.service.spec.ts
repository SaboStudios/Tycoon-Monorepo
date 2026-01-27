import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityChestService } from './community-chest.service';
import { CommunityChest } from './entities/community-chest.entity';

const mockCommunityChest = {
  id: 1,
  instruction: 'Advance to Go',
  type: 'advance_to_go',
  amount: 0,
  position: 0,
  extra: null,
};

describe('CommunityChestService', () => {
  let service: CommunityChestService;
  let mockCreateQueryBuilder: jest.Mock;

  beforeEach(async () => {
    mockCreateQueryBuilder = jest.fn(() => ({
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCommunityChest),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityChestService,
        {
          provide: getRepositoryToken(CommunityChest),
          useValue: {
            createQueryBuilder: mockCreateQueryBuilder,
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
      expect(mockCreateQueryBuilder).toHaveBeenCalledWith('community_chest');
    });
  });
});
