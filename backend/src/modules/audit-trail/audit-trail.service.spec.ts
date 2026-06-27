/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditTrailService } from './audit-trail.service';
import { AuditTrail, AuditAction } from './entities/audit-trail.entity';

describe('AuditTrailService', () => {
  let service: AuditTrailService;
  let repository: Repository<AuditTrail>;

  const mockAuditTrail = {
    id: 1,
    action: AuditAction.USER_CREATED,
    userId: 1,
    userEmail: 'user@example.com',
    performedBy: 2,
    performedByEmail: 'admin@example.com',
    changes: { role: 'admin' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    reason: 'test reason',
    createdAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn().mockImplementation((dto: unknown) => dto),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) =>
        Promise.resolve({ id: 1, ...(entity as Record<string, unknown>) }),
      ),
    findAndCount: jest.fn().mockResolvedValue([[mockAuditTrail], 1]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditTrailService,
        {
          provide: getRepositoryToken(AuditTrail),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuditTrailService>(AuditTrailService);
    repository = module.get<Repository<AuditTrail>>(
      getRepositoryToken(AuditTrail),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create and save an audit trail log', async () => {
      const options = {
        userId: 1,
        userEmail: 'user@example.com',
        performedBy: 2,
        performedByEmail: 'admin@example.com',
        changes: { role: 'admin' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        reason: 'test reason',
      };

      const result = await service.log(AuditAction.USER_CREATED, options);

      expect(repository.create).toHaveBeenCalledWith({
        action: AuditAction.USER_CREATED,
        ...options,
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual({
        id: 1,
        action: AuditAction.USER_CREATED,
        ...options,
      });
    });
  });

  describe('getUserAuditTrail', () => {
    it('should query logs by userId with default pagination', async () => {
      const result = await service.getUserAuditTrail(1);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual({ data: [mockAuditTrail], total: 1 });
    });

    it('should query logs by userId with custom pagination', async () => {
      await service.getUserAuditTrail(1, 10, 20);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 20,
      });
    });
  });

  describe('getAuditTrailByAction', () => {
    it('should query logs by action with default pagination', async () => {
      const result = await service.getAuditTrailByAction(
        AuditAction.USER_CREATED,
      );

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { action: AuditAction.USER_CREATED },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual({ data: [mockAuditTrail], total: 1 });
    });

    it('should query logs by action with custom pagination', async () => {
      await service.getAuditTrailByAction(AuditAction.USER_CREATED, 10, 20);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { action: AuditAction.USER_CREATED },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 20,
      });
    });
  });

  describe('findAll', () => {
    it('should query logs with all filters', async () => {
      const queryDto = {
        userId: 1,
        action: AuditAction.USER_CREATED,
        limit: 10,
        offset: 20,
      };

      const result = await service.findAll(queryDto);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 1, action: AuditAction.USER_CREATED },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 20,
      });
      expect(result).toEqual({ data: [mockAuditTrail], total: 1 });
    });

    it('should query logs with partial filters and default pagination', async () => {
      await service.findAll({});

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
    });
  });
});
