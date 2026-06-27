import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailService } from './audit-trail.service';
import { AuditAction } from './entities/audit-trail.entity';
import {
  QueryAuditTrailDto,
  PaginationQueryDto,
} from './dto/query-audit-trail.dto';
import {
  UserAuditTrailParamsDto,
  ActionAuditTrailParamsDto,
} from './dto/params-audit-trail.dto';

describe('AuditTrailController & DTO Validation', () => {
  let controller: AuditTrailController;
  let service: Partial<AuditTrailService>;

  const mockAuditTrail = {
    id: 1,
    action: AuditAction.USER_CREATED,
    userId: 1,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      findAll: jest
        .fn()
        .mockResolvedValue({ data: [mockAuditTrail], total: 1 }),
      getUserAuditTrail: jest
        .fn()
        .mockResolvedValue({ data: [mockAuditTrail], total: 1 }),
      getAuditTrailByAction: jest
        .fn()
        .mockResolvedValue({ data: [mockAuditTrail], total: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditTrailController],
      providers: [
        {
          provide: AuditTrailService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AuditTrailController>(AuditTrailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Endpoints delegation', () => {
    it('should delegate findAll to service', async () => {
      const query: QueryAuditTrailDto = {
        userId: 1,
        action: AuditAction.USER_CREATED,
        limit: 10,
        offset: 0,
      };
      const result = await controller.findAll(query);
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual({ data: [mockAuditTrail], total: 1 });
    });

    it('should delegate getUserAuditTrail to service', async () => {
      const params: UserAuditTrailParamsDto = { userId: 1 };
      const query: PaginationQueryDto = { limit: 10, offset: 0 };
      const result = await controller.getUserAuditTrail(params, query);
      expect(service.getUserAuditTrail).toHaveBeenCalledWith(1, 10, 0);
      expect(result).toEqual({ data: [mockAuditTrail], total: 1 });
    });

    it('should delegate getAuditTrailByAction to service', async () => {
      const params: ActionAuditTrailParamsDto = {
        action: AuditAction.USER_CREATED,
      };
      const query: PaginationQueryDto = { limit: 10, offset: 0 };
      const result = await controller.getAuditTrailByAction(params, query);
      expect(service.getAuditTrailByAction).toHaveBeenCalledWith(
        AuditAction.USER_CREATED,
        10,
        0,
      );
      expect(result).toEqual({ data: [mockAuditTrail], total: 1 });
    });
  });

  describe('QueryAuditTrailDto Validation', () => {
    it('should accept valid query params', async () => {
      const dto = plainToInstance(QueryAuditTrailDto, {
        userId: 1,
        action: AuditAction.USER_CREATED,
        limit: 10,
        offset: 5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should use default values for limit and offset', () => {
      const dto = plainToInstance(QueryAuditTrailDto, {});
      expect(dto.limit).toBe(50);
      expect(dto.offset).toBe(0);
    });

    it('should reject invalid userId (<1)', async () => {
      const dto = plainToInstance(QueryAuditTrailDto, { userId: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('userId');
    });

    it('should reject invalid action type', async () => {
      const dto = plainToInstance(QueryAuditTrailDto, {
        action: 'INVALID_ACTION',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('action');
    });

    it('should reject invalid limit (<1)', async () => {
      const dto = plainToInstance(QueryAuditTrailDto, { limit: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });

    it('should reject invalid limit (>100)', async () => {
      const dto = plainToInstance(QueryAuditTrailDto, { limit: 101 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });

    it('should reject invalid offset (<0)', async () => {
      const dto = plainToInstance(QueryAuditTrailDto, { offset: -1 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('offset');
    });
  });

  describe('UserAuditTrailParamsDto Validation', () => {
    it('should accept valid userId', async () => {
      const dto = plainToInstance(UserAuditTrailParamsDto, { userId: 42 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid userId (0)', async () => {
      const dto = plainToInstance(UserAuditTrailParamsDto, { userId: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('userId');
    });

    it('should reject invalid userId (non-integer)', async () => {
      const dto = plainToInstance(UserAuditTrailParamsDto, { userId: 1.5 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('userId');
    });
  });

  describe('ActionAuditTrailParamsDto Validation', () => {
    it('should accept valid action', async () => {
      const dto = plainToInstance(ActionAuditTrailParamsDto, {
        action: AuditAction.GAME_CREATED,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid action', async () => {
      const dto = plainToInstance(ActionAuditTrailParamsDto, {
        action: 'NOT_AN_ACTION',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('action');
    });
  });
});
