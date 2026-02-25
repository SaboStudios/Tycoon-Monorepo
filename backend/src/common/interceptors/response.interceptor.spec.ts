import { ResponseInterceptor } from './response.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<any>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockResponse: { statusCode: number };

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
    mockResponse = { statusCode: 200 };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn(),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as ExecutionContext;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should wrap object response in standard format', (done) => {
    const testData = { id: 1, name: 'Test' };
    mockCallHandler = { handle: () => of(testData) };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual({
          success: true,
          message: 'Operation successful',
          data: testData,
          statusCode: 200,
        });
        done();
      });
  });

  it('should wrap array response in standard format', (done) => {
    const testData = [{ id: 1 }, { id: 2 }];
    mockCallHandler = { handle: () => of(testData) };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual({
          success: true,
          message: 'Operation successful',
          data: testData,
          statusCode: 200,
        });
        done();
      });
  });

  it('should wrap string response in standard format', (done) => {
    const testData = 'Hello World!';
    mockCallHandler = { handle: () => of(testData) };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual({
          success: true,
          message: 'Operation successful',
          data: testData,
          statusCode: 200,
        });
        done();
      });
  });

  it('should handle null data', (done) => {
    mockCallHandler = { handle: () => of(null) };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual({
          success: true,
          message: 'Operation successful',
          data: null,
          statusCode: 200,
        });
        done();
      });
  });

  it('should handle undefined data (void responses)', (done) => {
    mockResponse.statusCode = 204;
    mockCallHandler = { handle: () => of(undefined) };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual({
          success: true,
          message: 'Operation successful',
          data: null,
          statusCode: 204,
        });
        done();
      });
  });

  it('should preserve paginated response structure', (done) => {
    const paginatedData = {
      data: [{ id: 1 }, { id: 2 }],
      meta: {
        page: 1,
        limit: 10,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    mockCallHandler = { handle: () => of(paginatedData) };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual({
          success: true,
          message: 'Operation successful',
          data: paginatedData,
          statusCode: 200,
        });
        done();
      });
  });

  it('should use correct status code from response', (done) => {
    mockResponse.statusCode = 201;
    const testData = { id: 1 };
    mockCallHandler = { handle: () => of(testData) };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result.statusCode).toBe(201);
        done();
      });
  });
});
