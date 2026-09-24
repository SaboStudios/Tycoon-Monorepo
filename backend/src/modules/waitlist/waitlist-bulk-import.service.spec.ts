import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistService } from './waitlist.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Waitlist } from './entities/waitlist.entity';
import { PaginationService } from '../../common';

describe('WaitlistService – bulkImport', () => {
  let service: WaitlistService;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
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
          useValue: mockRepository,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should import valid rows and return correct counts', async () => {
    const csv = Buffer.from(
      'email_address,wallet_address\nuser1@example.com,0xabc\nuser2@example.com,0xdef\n',
    );

    // No existing entries
    mockRepository.find.mockResolvedValue([]);
    mockRepository.create.mockImplementation(
      (dto: Record<string, unknown>) => dto,
    );
    mockRepository.save.mockImplementation((entities: unknown) =>
      Promise.resolve(Array.isArray(entities) ? entities : [entities]),
    );

    const result = await service.bulkImport(csv);

    expect(result.message).toBe('Bulk import completed.');
    expect(result.data.totalRows).toBe(2);
    expect(result.data.importedCount).toBe(2);
    expect(result.data.duplicateCount).toBe(0);
    expect(result.data.errorCount).toBe(0);
    expect(result.data.errors).toHaveLength(0);
  });

  it('should skip rows that duplicate existing DB entries', async () => {
    const csv = Buffer.from(
      'email_address\nexisting@example.com\nnew@example.com\n',
    );

    mockRepository.find.mockResolvedValue([
      { wallet_address: null, email_address: 'existing@example.com' },
    ]);
    mockRepository.create.mockImplementation(
      (dto: Record<string, unknown>) => dto,
    );
    mockRepository.save.mockImplementation((entities: unknown) =>
      Promise.resolve(Array.isArray(entities) ? entities : [entities]),
    );

    const result = await service.bulkImport(csv);

    expect(result.data.importedCount).toBe(1);
    expect(result.data.duplicateCount).toBe(1);
  });

  it('should skip intra-file duplicate emails', async () => {
    const csv = Buffer.from(
      'email_address\nuser@example.com\nuser@example.com\n',
    );

    mockRepository.find.mockResolvedValue([]);
    mockRepository.create.mockImplementation(
      (dto: Record<string, unknown>) => dto,
    );
    mockRepository.save.mockImplementation((entities: unknown) =>
      Promise.resolve(Array.isArray(entities) ? entities : [entities]),
    );

    const result = await service.bulkImport(csv);

    expect(result.data.importedCount).toBe(1);
    expect(result.data.duplicateCount).toBe(1);
  });

  it('should report validation errors for invalid email format', async () => {
    const csv = Buffer.from('email_address\nnot-an-email\nvalid@example.com\n');

    mockRepository.find.mockResolvedValue([]);
    mockRepository.create.mockImplementation(
      (dto: Record<string, unknown>) => dto,
    );
    mockRepository.save.mockImplementation((entities: unknown) =>
      Promise.resolve(Array.isArray(entities) ? entities : [entities]),
    );

    const result = await service.bulkImport(csv);

    expect(result.data.importedCount).toBe(1);
    expect(result.data.errorCount).toBe(1);
    expect(result.data.errors[0].row).toBe(1);
    expect(result.data.errors[0].error).toContain('Invalid email format');
  });

  it('should report validation errors for invalid telegram username', async () => {
    const csv = Buffer.from('telegram_username\ninvalid user!!\nvalid_user\n');

    mockRepository.find.mockResolvedValue([]);
    mockRepository.create.mockImplementation(
      (dto: Record<string, unknown>) => dto,
    );
    mockRepository.save.mockImplementation((entities: unknown) =>
      Promise.resolve(Array.isArray(entities) ? entities : [entities]),
    );

    const result = await service.bulkImport(csv);

    expect(result.data.importedCount).toBe(1);
    expect(result.data.errorCount).toBe(1);
    expect(result.data.errors[0].error).toContain('Invalid telegram username');
  });

  it('should handle batch insert failure with row-by-row fallback', async () => {
    const csv = Buffer.from(
      'email_address\nuser1@example.com\nuser2@example.com\n',
    );

    mockRepository.find.mockResolvedValue([]);
    mockRepository.create.mockImplementation(
      (dto: Record<string, unknown>) => dto,
    );

    // First call (batch) fails, then row-by-row succeeds
    let callCount = 0;
    mockRepository.save.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('batch failed'));
      }
      return Promise.resolve({});
    });

    const result = await service.bulkImport(csv);

    expect(result.data.importedCount).toBe(2);
  });

  it('should handle DB unique constraint error during row-by-row fallback', async () => {
    const csv = Buffer.from('email_address\nuser1@example.com\n');

    mockRepository.find.mockResolvedValue([]);
    mockRepository.create.mockImplementation(
      (dto: Record<string, unknown>) => dto,
    );

    // Batch fails, then row-by-row also fails with 23505
    mockRepository.save.mockImplementation(() => {
      const err = new Error('unique violation') as Error & { code?: string };
      err.code = '23505';
      return Promise.reject(err);
    });

    const result = await service.bulkImport(csv);

    expect(result.data.importedCount).toBe(0);
    expect(result.data.duplicateCount).toBe(1);
  });

  it('should reject CSV with invalid structure', async () => {
    const csv = Buffer.from('');

    await expect(service.bulkImport(csv)).rejects.toThrow();
  });
});
