import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaitlistService } from './waitlist.service';
import { Waitlist } from './entities/waitlist.entity';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaginationService } from '../../common';

describe('WaitlistService - Update/Delete', () => {
  let service: WaitlistService;
  let repository: Repository<Waitlist>;

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    delete: jest.fn(),
  };

  const mockPaginationService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        {
          provide: getRepositoryToken(Waitlist),
          useValue: mockRepository,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
    repository = module.get<Repository<Waitlist>>(getRepositoryToken(Waitlist));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('update', () => {
    it('should update a waitlist entry successfully', async () => {
      const id = 1;
      const updateDto: UpdateWaitlistDto = {
        email_address: 'newemail@example.com',
      };

      const existingEntry: Waitlist = {
        id,
        wallet_address: 'GXXX',
        email_address: 'old@example.com',
        telegram_username: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      const updatedEntry = { ...existingEntry, ...updateDto };

      mockRepository.findOne.mockResolvedValueOnce(existingEntry);
      mockRepository.findOne.mockResolvedValueOnce(null); // No duplicate email
      mockRepository.save.mockResolvedValue(updatedEntry);

      const result = await service.update(id, updateDto);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(repository.save).toHaveBeenCalled();
      expect(result.email_address).toBe(updateDto.email_address);
    });

    it('should throw BadRequestException if entry not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(1, { email_address: 'test@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if email already exists', async () => {
      const existingEntry: Waitlist = {
        id: 1,
        wallet_address: 'GXXX',
        email_address: 'old@example.com',
        telegram_username: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      const duplicateEntry: Waitlist = {
        id: 2,
        wallet_address: 'GYYY',
        email_address: 'duplicate@example.com',
        telegram_username: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      mockRepository.findOne.mockResolvedValueOnce(existingEntry);
      mockRepository.findOne.mockResolvedValueOnce(duplicateEntry);

      await expect(
        service.update(1, { email_address: 'duplicate@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a waitlist entry', async () => {
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.softDelete(1);

      expect(repository.softDelete).toHaveBeenCalledWith(1);
    });

    it('should throw BadRequestException if entry not found', async () => {
      mockRepository.softDelete.mockResolvedValue({ affected: 0 });

      await expect(service.softDelete(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a waitlist entry', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.hardDelete(1);

      expect(repository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw BadRequestException if entry not found', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.hardDelete(1)).rejects.toThrow(BadRequestException);
    });
  });
});
