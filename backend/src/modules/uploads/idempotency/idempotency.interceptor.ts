import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { Reflector } from '@nestjs/core';
import { IDEMPOTENCY_KEY_OPTIONS, IdempotencyOptions } from './idempotency.constants';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Get idempotency options from metadata
    const options = this.reflector.get<IdempotencyOptions>(
      IDEMPOTENCY_KEY_OPTIONS,
      context.getHandler(),
    ) || {};

    // Skip idempotency for non-idempotent methods
    if (!this.isIdempotentMethod(request.method)) {
      return next.handle();
    }

    try {
      // Check if this request has been processed before
      const existingRecord = await this.idempotencyService.checkIdempotency(request, options);
      
      if (existingRecord) {
        // Validate request integrity
        const isValid = this.idempotencyService.validateRequestIntegrity(request, existingRecord, options);
        
        if (!isValid) {
          throw new ConflictException({
            error: 'IDEMPOTENCY_MISMATCH',
            message: 'Request content differs from original request with same idempotency key',
          });
        }

        // Return cached response
        if (existingRecord.response) {
          // Set response headers
          Object.entries(existingRecord.response.headers).forEach(([key, value]) => {
            if (!key.toLowerCase().startsWith('x-')) {
              response.set(key, value);
            }
          });
          
          response.set('X-Idempotent-Replayed', 'true');
          response.status(existingRecord.response.statusCode);
          
          return new Observable(subscriber => {
            subscriber.next(existingRecord.response.body);
            subscriber.complete();
          });
        } else {
          throw new ConflictException({
            error: 'IDEMPOTENCY_PROCESSED',
            message: 'Request has already been processed but response is not available for replay',
          });
        }
      }

      // Process the request normally
      return next.handle().pipe(
        map(async (data) => {
          // Store the response for future idempotency checks
          const statusCode = response.statusCode || HttpStatus.OK;
          
          await this.idempotencyService.storeResponse(
            request,
            {
              statusCode,
              getHeaders: () => response.getHeaders(),
              body: data,
            },
            options,
          );

          response.set('X-Idempotent', 'true');
          return data;
        }),
        catchError(async (error) => {
          // Store error responses for idempotency as well
          const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
          
          await this.idempotencyService.storeResponse(
            request,
            {
              statusCode,
              getHeaders: () => response.getHeaders(),
              body: {
                error: error.response?.error || 'INTERNAL_ERROR',
                message: error.message,
                timestamp: new Date().toISOString(),
              },
            },
            options,
          );

          response.set('X-Idempotent', 'true');
          return throwError(() => error);
        }),
      );
    } catch (error) {
      // Handle idempotency service errors gracefully
      if (error instanceof ConflictException) {
        throw error;
      }
      
      // Log the error but don't fail the request
      console.error('Idempotency service error:', error);
      return next.handle();
    }
  }

  /**
   * Check if HTTP method should be idempotent
   */
  private isIdempotentMethod(method: string): boolean {
    const idempotentMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE', 'PUT', 'DELETE', 'PATCH'];
    return idempotentMethods.includes(method.toUpperCase());
  }
}
