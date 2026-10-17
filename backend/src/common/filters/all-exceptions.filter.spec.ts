import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { LoggerService } from '../logger/logger.service';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let httpAdapterHost: HttpAdapterHost;
  let logger: LoggerService;
  let reply: jest.Mock;
  let status: jest.Mock;
  let host: any;

  beforeEach(() => {
    reply = jest.fn();
    status = jest.fn().mockReturnValue({ json: reply });

    httpAdapterHost = {
      httpAdapter: {
        reply,
        getRequestUrl: jest.fn().mockReturnValue('/test'),
      },
    } as unknown as HttpAdapterHost;

    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    } as unknown as LoggerService;

    filter = new AllExceptionsFilter(httpAdapterHost, logger);

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({}),
      }),
    };
  });

  it('returns a sanitised 500 response for a plain Error without leaking details', () => {
    const error = new Error('secret detail');

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(reply).toHaveBeenCalled();

    const body = reply.mock.calls[0][0];
    expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('secret detail');
  });

  it('preserves the status and message of an HttpException', () => {
    const error = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(reply).toHaveBeenCalled();

    const body = reply.mock.calls[0][0];
    expect(body.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe('Not found');
  });

  it('logs the original error', () => {
    const error = new Error('secret detail');

    filter.catch(error, host);

    expect(logger.error).toHaveBeenCalledWith(error);
  });
});
