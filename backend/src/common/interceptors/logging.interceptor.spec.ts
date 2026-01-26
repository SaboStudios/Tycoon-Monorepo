import { Test, TestingModule } from '@nestjs/testing';
import { LoggingInterceptor } from './logging.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should log request and call next.handle()', (done) => {
      const mockRequest = {
        method: 'GET',
        url: '/test',
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const mockCallHandler = {
        handle: () => of('test-response'),
      } as unknown as CallHandler;

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (response) => {
          expect(response).toBe('test-response');
          done();
        },
      });
    });
  });
});
