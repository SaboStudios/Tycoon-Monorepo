import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CommunityChestObservabilityService } from './community-chest-observability.service';
import { CommunityChest } from './entities/community-chest.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CommunityChestObservabilityInterceptor implements NestInterceptor {
  constructor(
    private readonly observability: CommunityChestObservabilityService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const path = request.path;

    // Extract or create correlation ID
    const correlationId =
      request.headers['x-correlation-id'] || uuidv4();

    // Map HTTP methods to operations
    let operation: 'draw' | 'create' | 'list' | 'get' = 'list';
    if (path.includes('/draw')) operation = 'draw';
    if (method === 'POST') operation = 'create';
    if (path.match(/\/\d+$/)) operation = 'get';

    // Start timer
    const timer = this.observability.startTimer(
      operation as 'draw' | 'create' | 'list',
    );

    return next.handle().pipe(
      tap((data: any) => {
        // Log successful response
        if (operation === 'draw') {
          if (data) {
            this.observability.recordCardDraw(
              data.type,
              correlationId,
            );
          }
        } else if (operation === 'create') {
          if (data && typeof data === 'object') {
            this.observability.recordCardCreated(
              (data as CommunityChest).type,
              correlationId,
              (data as CommunityChest).amount || undefined,
            );
          }
        } else if (operation === 'list') {
          if (Array.isArray(data)) {
            this.observability.recordListOperation(data.length, correlationId);
          }
        } else if (operation === 'get') {
          if (data) {
            this.observability.recordCardRetrieved(
              (data as CommunityChest).id,
              true,
              correlationId,
            );
          } else {
            this.observability.recordCardRetrieved(
              parseInt(request.params.id || '0', 10),
              false,
              correlationId,
            );
          }
        }

        // End timer
        timer.end();
      }),
      catchError((error: any) => {
        // Record error
        const errorType = error.constructor.name || 'Unknown';
        this.observability.recordError(
          operation as any,
          errorType,
          error.message,
          correlationId,
        );

        // End timer
        timer.end();

        return throwError(() => error);
      }),
    );
  }
}
