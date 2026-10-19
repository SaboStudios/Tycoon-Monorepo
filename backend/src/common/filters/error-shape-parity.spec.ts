import { ArgumentsHost, HttpStatus, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpExceptionFilter } from './http-exception.filter';

/**
 * Fields documented in docs/API_ERROR_RESPONSE_STANDARDS.md as the standard
 * error response shape. This is the source of truth for the contract test.
 */
const DOCUMENTED_ERROR_FIELDS = [
  'status',
  'message',
  'code',
  'requestId',
  'timestamp',
];

interface CapturedResponse {
  status: number;
  body: Record<string, unknown>;
}

function createMockHost(): { host: ArgumentsHost; captured: CapturedResponse } {
  const captured: CapturedResponse = { status: 0, body: {} };

  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
    setHeader() {
      return this;
    },
    getHeader() {
      return undefined;
    },
  };

  const request = {
    url: '/test',
    method: 'GET',
    headers: {},
    requestId: 'test-request-id',
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
      getNext: () => undefined,
    }),
    getType: () => 'http',
    getArgs: () => [request, response],
    getArgByIndex: (index: number) => [request, response][index],
    switchToRpc: () => ({} as never),
    switchToWs: () => ({} as never),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

function createHttpAdapterHost(): HttpAdapterHost {
  const httpAdapter = {
    reply: (response: unknown, body: unknown, statusCode: number) => {
      const res = response as {
        status: (code: number) => unknown;
        json: (payload: unknown) => unknown;
      };
      res.status(statusCode);
      res.json(body);
    },
    getRequestHostname: () => 'localhost',
    getRequestMethod: () => 'GET',
    getRequestUrl: () => '/test',
  };

  return { httpAdapter } as unknown as HttpAdapterHost;
}

describe('error shape parity between exception filters', () => {
  const exception = new NotFoundException('Resource not found');

  it('produces identical response body key sets for the same exception', () => {
    const httpAdapterHost = createHttpAdapterHost();

    const httpFilter = new HttpExceptionFilter(httpAdapterHost);
    const allFilter = new AllExceptionsFilter(httpAdapterHost);

    const httpHost = createMockHost();
    const allHost = createMockHost();

    httpFilter.catch(exception, httpHost.host);
    allFilter.catch(exception, allHost.host);

    const httpKeys = Object.keys(httpHost.captured.body).sort();
    const allKeys = Object.keys(allHost.captured.body).sort();

    expect(httpKeys).toEqual(allKeys);
  });

  it('matches the fields documented in docs/API_ERROR_RESPONSE_STANDARDS.md', () => {
    const httpAdapterHost = createHttpAdapterHost();

    const httpFilter = new HttpExceptionFilter(httpAdapterHost);
    const allFilter = new AllExceptionsFilter(httpAdapterHost);

    const httpHost = createMockHost();
    const allHost = createMockHost();

    httpFilter.catch(exception, httpHost.host);
    allFilter.catch(exception, allHost.host);

    const documented = [...DOCUMENTED_ERROR_FIELDS].sort();

    expect(Object.keys(httpHost.captured.body).sort()).toEqual(documented);
    expect(Object.keys(allHost.captured.body).sort()).toEqual(documented);
  });

  it('produces the same HTTP status for the same exception', () => {
    const httpAdapterHost = createHttpAdapterHost();

    const httpFilter = new HttpExceptionFilter(httpAdapterHost);
    const allFilter = new AllExceptionsFilter(httpAdapterHost);

    const httpHost = createMockHost();
    const allHost = createMockHost();

    httpFilter.catch(exception, httpHost.host);
    allFilter.catch(exception, allHost.host);

    expect(httpHost.captured.status).toBe(HttpStatus.NOT_FOUND);
    expect(allHost.captured.status).toBe(HttpStatus.NOT_FOUND);
    expect(httpHost.captured.status).toBe(allHost.captured.status);
  });
});
