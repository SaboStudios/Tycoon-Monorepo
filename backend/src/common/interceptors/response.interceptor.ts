import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StandardResponse } from '../interfaces/standard-response.interface';

/**
 * Global response interceptor that wraps all responses in a standardized format.
 * 
 * Response format:
 * {
 *   "success": true,
 *   "message": "Operation successful",
 *   "data": {},
 *   "statusCode": 200
 * }
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<StandardResponse<T>> {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        return next.handle().pipe(
            map((data) => {
                // Handle void/undefined responses (e.g., DELETE with 204)
                if (data === undefined) {
                    return {
                        success: true,
                        message: 'Operation successful',
                        data: null,
                        statusCode,
                    };
                }

                return {
                    success: true,
                    message: 'Operation successful',
                    data: data ?? null,
                    statusCode,
                };
            }),
        );
    }
}
