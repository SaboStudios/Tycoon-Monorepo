
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
        // In certain situations `httpAdapter` might not be available in the
        // constructor method, thus we should resolve it here.
        const { httpAdapter } = this.httpAdapterHost;

        const ctx = host.switchToHttp();

        const httpStatus =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const responseBody = {
            statusCode: httpStatus,
            timestamp: new Date().toISOString(),
            path: httpAdapter.getRequestUrl(ctx.getRequest()),
            message: 'Internal server error',
            code: undefined,
        };

        if (exception instanceof HttpException) {
            const response = exception.getResponse();
            responseBody.message =
                typeof response === 'string'
                    ? response
                    : (response as any).message || (exception as Error).message;

            if (typeof response === 'object' && (response as any).error) {
                responseBody['error'] = (response as any).error;
            }
        } else {
            // Log the actual error for non-HTTP exceptions (internal errors)
            this.logger.error(exception);

            // Check for common TypeORM errors
            if ((exception as any).code === '23505') {
                responseBody.statusCode = HttpStatus.CONFLICT;
                responseBody.message = 'Duplicate entry';
            }
        }

        // In production, keep 500 errors generic. 
        // In dev, you might want to show more info, but requirement says "Hide internal ... details in production"
        // We already default 500s to 'Internal server error' above for non-HttpExceptions.
        // If it WAS an HttpException (e.g. 400), we passed the message through.

        httpAdapter.reply(ctx.getResponse(), responseBody, responseBody.statusCode);
    }
}
