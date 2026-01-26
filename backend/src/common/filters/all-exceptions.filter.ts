import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    constructor(private readonly httpAdapterHost: HttpAdapterHost) { }

    catch(exception: unknown, host: ArgumentsHost): void {
        const { httpAdapter } = this.httpAdapterHost;
        const ctx = host.switchToHttp();

        let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let error: string | undefined;

        if (exception instanceof HttpException) {
            httpStatus = exception.getStatus();
            const response = exception.getResponse();

            if (typeof response === 'string') {
                message = response;
            } else {
                const responseObj = response as any;
                message = responseObj.message || exception.message;
                error = responseObj.error;
            }
        } else {
            this.logger.error(exception);

            // Handle common database errors
            const dbError = exception as any;
            if (dbError.code) {
                switch (dbError.code) {
                    case '23505': // Duplicate key
                        httpStatus = HttpStatus.CONFLICT;
                        message = 'Duplicate entry';
                        break;
                    case '23503': // Foreign key violation
                        httpStatus = HttpStatus.BAD_REQUEST;
                        message = 'Referenced record does not exist';
                        break;
                    case '23502': // Not null violation
                        httpStatus = HttpStatus.BAD_REQUEST;
                        message = 'Required field is missing';
                        break;
                }
            }
        }

        const responseBody = {
            statusCode: httpStatus,
            timestamp: new Date().toISOString(),
            path: httpAdapter.getRequestUrl(ctx.getRequest()),
            message,
            ...(error && { error }),
        };

        httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
    }
}
