import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types/error-response';

export class ErrorHandlerMiddleware {
    handle = (
        err: any,
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        const statusCode = err.statusCode || err.status || 500;
        const message = err.message || 'Internal Server Error';

        const errorResponse: ErrorResponse = {
            statusCode,
            message,
            error: err.name || 'Error',
            timestamp: new Date().toISOString(),
            path: req.path,
        };

        if (process.env.NODE_ENV === 'development') {
            errorResponse.details = {
                stack: err.stack,
                originalError: err,
            };
        }

        res.status(statusCode).json(errorResponse);
    };
}
