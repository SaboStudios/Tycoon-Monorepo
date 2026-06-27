/**
 * #879 — board-styles DTO validation and error mapping
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateBoardStyleDto } from './dto/create-board-style.dto';
import { BoardStylesService } from './board-styles.service';
import { BoardStyle } from './entities/board-style.entity';
import { PaginationService } from '../../common';
import { RedisService } from '../redis/redis.service';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { LoggerService } from '../../common/logger/logger.service';

async function getErrors(DtoClass: new () => object, plain: object) {
  const instance = plainToInstance(DtoClass as new () => object, plain);
  const errors = await validate(instance);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreateBoardStyleDto validation (#879)', () => {
  const valid = { name: 'Cyberpunk Theme' };

  it('passes with valid input', async () => {
    expect(await getErrors(CreateBoardStyleDto, valid)).toHaveLength(0);
  });

  it('returns 400 message when required name is missing', async () => {
    const errors = await getErrors(CreateBoardStyleDto, { name: '' });
    expect(errors.some((m) => m.includes('board style name is required'))).toBe(
      true,
    );
  });

  it('returns 400 when price is below minimum', async () => {
    const errors = await getErrors(CreateBoardStyleDto, {
      ...valid,
      price: -1,
    });
    expect(
      errors.some((m) => m.includes('price must be a non-negative number')),
    ).toBe(true);
  });

  it('returns 400 when optional boolean field has invalid type', async () => {
    const errors = await getErrors(CreateBoardStyleDto, {
      ...valid,
      is_premium: 'not-a-boolean',
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('BoardStylesService error mapping (#879)', () => {
  let service: BoardStylesService;

  const mockBoardStyleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardStylesService,
        {
          provide: getRepositoryToken(BoardStyle),
          useValue: mockBoardStyleRepository,
        },
        {
          provide: PaginationService,
          useValue: { paginate: jest.fn() },
        },
        {
          provide: RedisService,
          useValue: { delByPattern: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BoardStylesService>(BoardStylesService);
  });

  it('maps missing name to BadRequestException', async () => {
    await expect(service.create({ name: '   ' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create({ name: '   ' })).rejects.toThrow(
      'board style name is required',
    );
  });

  it('maps not-found to NotFoundException with 404 semantics', async () => {
    mockBoardStyleRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('HttpExceptionFilter maps validation errors to standard response shape', () => {
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockRequest = {
      method: 'POST',
      url: '/board-styles',
      ip: '127.0.0.1',
      headers: {},
    };
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      logWithMeta: jest.fn(),
    } as unknown as LoggerService;

    const filter = new HttpExceptionFilter(logger);
    filter.catch(new BadRequestException('board style name is required'), {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as never);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'board style name is required',
        data: null,
        statusCode: 400,
      }),
    );
  });
});
