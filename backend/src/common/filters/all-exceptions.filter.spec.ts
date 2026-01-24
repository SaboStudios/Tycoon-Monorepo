
import { AllExceptionsFilter } from './all-exceptions.filter';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

const mockHttpAdapterHost = {
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

    it('should catch HttpException and format response', () => {
        const mockJson = jest.fn();
        const mockStatus = jest.fn().mockReturnThis();
        const mockGetResponse = jest.fn().mockReturnValue({
            status: mockStatus,
            json: mockJson,
        });
        const mockGetRequest = jest.fn();
        const mockArgumentsHost = {
            switchToHttp: () => ({
                getResponse: mockGetResponse,
                getRequest: mockGetRequest,
            }),
        } as unknown as ArgumentsHost;

        mockHttpAdapterHost.httpAdapter.getRequestUrl.mockReturnValue('/test-url');

        const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
        filter.catch(exception, mockArgumentsHost);

        expect(mockHttpAdapterHost.httpAdapter.reply).toHaveBeenCalled();
        const responseBody = mockHttpAdapterHost.httpAdapter.reply.mock.calls[0][1];
        expect(responseBody).toMatchObject({
            statusCode: 400,
            path: '/test-url',
            message: 'Bad Request',
        });
    });

    it('should catch unknown errors and return 500', () => {
        const mockGetResponse = jest.fn();
        const mockGetRequest = jest.fn();
        const mockArgumentsHost = {
            switchToHttp: () => ({
                getResponse: mockGetResponse,
                getRequest: mockGetRequest,
            }),
        } as unknown as ArgumentsHost;

        mockHttpAdapterHost.httpAdapter.getRequestUrl.mockReturnValue('/test-url');

        const exception = new Error('Random error');
        filter.catch(exception, mockArgumentsHost);

        const responseBody = mockHttpAdapterHost.httpAdapter.reply.mock.calls[0][1];
        // In strict 500 mode default message is "Internal server error"
        expect(responseBody).toMatchObject({
            statusCode: 500,
            path: '/test-url',
            message: 'Internal server error',
        });
    });
});
