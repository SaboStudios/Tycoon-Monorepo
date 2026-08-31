import { Test, TestingModule } from '@nestjs/testing';
import { UserSkinsService } from './user-skins.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserSkin } from './entities/user-skin.entity';
import { Skin } from './entities/skin.entity';
import { NotFoundException } from '@nestjs/common';

describe('UserSkinsService', () => {
  let service: UserSkinsService;

  const mockUserSkinRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSkinRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSkinsService,
        {
          provide: getRepositoryToken(UserSkin),
          useValue: mockUserSkinRepository,
        },
        {
          provide: getRepositoryToken(Skin),
          useValue: mockSkinRepository,
        },
      ],
    }).compile();

    service = module.get<UserSkinsService>(UserSkinsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('unlockSkin', () => {
    const userId = 1;
    const skinId = 5;

    it('should throw NotFoundException when skin does not exist', async () => {
      mockSkinRepository.findOne.mockResolvedValue(null);

      await expect(service.unlockSkin(userId, skinId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockSkinRepository.findOne).toHaveBeenCalledWith({
        where: { id: skinId },
      });
    });

    it('should return existing unlock when user already owns the skin (idempotent)', async () => {
      const existingUserSkin: UserSkin = {
        id: 1,
        user_id: userId,
        skin_id: skinId,
        unlocked_at: new Date('2026-01-01'),
        user: null,
        skin: null,
      };

      mockSkinRepository.findOne.mockResolvedValue({ id: skinId });
      mockUserSkinRepository.findOne.mockResolvedValue(existingUserSkin);

      const result = await service.unlockSkin(userId, skinId);

      expect(result).toEqual(existingUserSkin);
      expect(mockUserSkinRepository.create).not.toHaveBeenCalled();
      expect(mockUserSkinRepository.save).not.toHaveBeenCalled();
    });

    it('should create and return new unlock when user does not own the skin', async () => {
      const newUserSkin: UserSkin = {
        id: 2,
        user_id: userId,
        skin_id: skinId,
        unlocked_at: new Date(),
        user: null,
        skin: null,
      };

      mockSkinRepository.findOne.mockResolvedValue({ id: skinId });
      mockUserSkinRepository.findOne.mockResolvedValue(null);
      mockUserSkinRepository.create.mockReturnValue(newUserSkin);
      mockUserSkinRepository.save.mockResolvedValue(newUserSkin);

      const result = await service.unlockSkin(userId, skinId);

      expect(result).toEqual(newUserSkin);
      expect(mockUserSkinRepository.create).toHaveBeenCalledWith({
        user_id: userId,
        skin_id: skinId,
      });
      expect(mockUserSkinRepository.save).toHaveBeenCalledWith(newUserSkin);
    });

    it('should handle multiple calls for the same user/skin (idempotency)', async () => {
      const existingUserSkin: UserSkin = {
        id: 1,
        user_id: userId,
        skin_id: skinId,
        unlocked_at: new Date('2026-01-01'),
        user: null,
        skin: null,
      };

      mockSkinRepository.findOne.mockResolvedValue({ id: skinId });
      mockUserSkinRepository.findOne.mockResolvedValue(existingUserSkin);

      const result1 = await service.unlockSkin(userId, skinId);
      const result2 = await service.unlockSkin(userId, skinId);

      expect(result1).toEqual(result2);
      expect(result1.id).toBe(1);
      expect(mockUserSkinRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAllByUserId', () => {
    it('should return all skins owned by a user', async () => {
      const userId = 1;
      const userSkins: UserSkin[] = [
        {
          id: 1,
          user_id: userId,
          skin_id: 5,
          unlocked_at: new Date(),
          user: null,
          skin: { id: 5, name: 'Skin A' } as Skin,
        },
      ];

      mockUserSkinRepository.find.mockResolvedValue(userSkins);

      const result = await service.findAllByUserId(userId);

      expect(result).toEqual(userSkins);
      expect(mockUserSkinRepository.find).toHaveBeenCalledWith({
        where: { user_id: userId },
        relations: ['skin'],
        order: { unlocked_at: 'DESC' },
      });
    });
  });

  describe('checkOwnership', () => {
    it('should return true when user owns the skin', async () => {
      mockUserSkinRepository.findOne.mockResolvedValue({ id: 1 });

      const result = await service.checkOwnership(1, 5);

      expect(result).toBe(true);
    });

    it('should return false when user does not own the skin', async () => {
      mockUserSkinRepository.findOne.mockResolvedValue(null);

      const result = await service.checkOwnership(1, 5);

      expect(result).toBe(false);
    });
  });
});
