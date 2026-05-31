import {
  ArgumentMetadata,
  BadRequestException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { LoggerService } from '../../common/logger/logger.service';
import {
  GameSortField,
  PaginatedGamesQueryDto,
  PaginatedUsersQueryDto,
  UserSortField,
} from './dto/analytics-query.dto';

describe('AdminAnalytics DTO validation and error mapping (#863)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const queryMetadata = <T>(metatype: new () => T): ArgumentMetadata => ({
    type: 'query',
    metatype,
    data: '',
  });

  it('transforms valid paginated user query strings into typed DTO values', async () => {
    const result = await pipe.transform(
      {
        page: '2',
        limit: '25',
        sortBy: UserSortField.EMAIL,
        sortOrder: 'ASC',
        search: 'alice',
      },
      queryMetadata(PaginatedUsersQueryDto),
    );

    expect(result).toBeInstanceOf(PaginatedUsersQueryDto);
    expect(result).toMatchObject({
      page: 2,
      limit: 25,
      sortBy: UserSortField.EMAIL,
      sortOrder: 'ASC',
      search: 'alice',
    });
  });

  it('rejects invalid user analytics query state before it reaches the service', async () => {
    await expect(
      pipe.transform(
        {
          page: '0',
          limit: '101',
          sortBy: 'password',
          unknown: 'drop-me',
        },
        queryMetadata(PaginatedUsersQueryDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid game analytics sort fields with a mapped validation error', async () => {
    await expect(
      pipe.transform(
        {
          sortBy: 'creator_id',
        },
        queryMetadata(PaginatedGamesQueryDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts only allowlisted game analytics sort fields', async () => {
    const result = await pipe.transform(
      {
        sortBy: GameSortField.STATUS,
      },
      queryMetadata(PaginatedGamesQueryDto),
    );

    expect(result).toBeInstanceOf(PaginatedGamesQueryDto);
    expect(result.sortBy).toBe(GameSortField.STATUS);
  });

  it('maps ValidationPipe errors to the repository standard 400 response body', () => {
    const exception = new BadRequestException({
      message: [
        'property unknown should not exist',
        'sortBy must be one of the following values: id, email, created_at, games_played, game_won',
      ],
      error: 'Bad Request',
      statusCode: HttpStatus.BAD_REQUEST,
    });
    const reply = jest.fn();
    const getRequestUrl = jest.fn().mockReturnValue('/admin/analytics/users');
    const filter = new AllExceptionsFilter(
      {
        httpAdapter: {
          reply,
          getRequestUrl,
        },
      } as unknown as HttpAdapterHost,
      {
        logWithMeta: jest.fn(),
        error: jest.fn(),
      } as unknown as LoggerService,
    );

    filter.catch(exception, {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/admin/analytics/users?sortBy=password',
          ip: '127.0.0.1',
          headers: {},
        }),
        getResponse: () => ({}),
      }),
    } as never);

    expect(reply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        path: '/admin/analytics/users',
        message:
          'property unknown should not exist; sortBy must be one of the following values: id, email, created_at, games_played, game_won',
        error: 'Bad Request',
      }),
      HttpStatus.BAD_REQUEST,
    );
  });
});
