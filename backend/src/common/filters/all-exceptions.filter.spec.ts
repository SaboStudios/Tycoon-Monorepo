import { AllExceptionsFilter } from './all-exceptions.filter';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

const mockHttpAdapterHost: {
  httpAdapter: {
    getRequestUrl: jest.Mock;
    reply: jest.Mock;
  };
} = {
  httpAdapter: {
    getRequestUrl: jest.fn(),
    reply: jest.fn(),
  },
};

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllExceptionsFilter,
        {
          provide: HttpAdapterHost,
          useValue: mockHttpAdapterHost,
        },
      ],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);
    jest.clearAllMocks();
  });

  const createMockArgumentsHost = () => {
    const mockGetResponse = jest.fn();
    const mockGetRequest = jest.fn();
    return {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    } as unknown as ArgumentsHost;
  };

  it('should catch HttpException and format response', () => {
    const mockHost = createMockArgumentsHost();
    mockHttpAdapterHost.httpAdapter.getRequestUrl.mockReturnValue('/test-url');

    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    filter.catch(exception, mockHost);

    const calls = mockHttpAdapterHost.httpAdapter.reply.mock
      .calls as unknown[][];
    const responseBody = calls[0][1] as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      statusCode: 400,
      path: '/test-url',
      message: 'Bad Request',
    });
  });

  it('should catch unknown errors and return 500', () => {
    const mockHost = createMockArgumentsHost();
    mockHttpAdapterHost.httpAdapter.getRequestUrl.mockReturnValue('/test-url');

    const exception = new Error('Random error');
    filter.catch(exception, mockHost);

    const calls = mockHttpAdapterHost.httpAdapter.reply.mock
      .calls as unknown[][];
    const responseBody = calls[0][1] as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      statusCode: 500,
      path: '/test-url',
      message: 'Internal server error',
    });
  });

  it('should map Postgres duplicate entry (23505) to 409 Conflict', () => {
    const mockHost = createMockArgumentsHost();
    const exception = { code: '23505' };

    filter.catch(exception, mockHost);

    const calls = mockHttpAdapterHost.httpAdapter.reply.mock
      .calls as unknown[][];
    const responseBody = calls[0][1] as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      message: 'Duplicate entry',
    });
  });

  it('should map Postgres foreign key violation (23503) to 400 Bad Request', () => {
    const mockHost = createMockArgumentsHost();
    const exception = { code: '23503' };

    filter.catch(exception, mockHost);

    const calls = mockHttpAdapterHost.httpAdapter.reply.mock
      .calls as unknown[][];
    const responseBody = calls[0][1] as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Referenced record does not exist',
    });
  });

  it('should map Postgres not null violation (23502) to 400 Bad Request', () => {
    const mockHost = createMockArgumentsHost();
    const exception = { code: '23502' };

    filter.catch(exception, mockHost);

    const calls = mockHttpAdapterHost.httpAdapter.reply.mock
      .calls as unknown[][];
    const responseBody = calls[0][1] as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Required field is missing',
    });
  });
});
