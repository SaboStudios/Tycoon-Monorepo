import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    statusMock = jest.fn();
    jsonMock = jest.fn();

    const response = {
      status: statusMock.mockReturnValue({ json: jsonMock }),
    };

    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({}),
      }),
    } as unknown as ArgumentsHost;
  });

  it('returns a stable 400 body shape for a BadRequestException', () => {
    filter.catch(new BadRequestException('bad'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledTimes(1);

    const body = jsonMock.mock.calls[0][0];
    expect(body).toEqual(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: expect.anything(),
      }),
    );
  });

  it('returns a generic 500 body for an unexpected Error without leaking details', () => {
    filter.catch(new Error('boom'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledTimes(1);

    const body = jsonMock.mock.calls[0][0];
    expect(body).toEqual(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: expect.any(String),
      }),
    );

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('boom');
    expect(serialized).not.toContain('at ');
  });
});
