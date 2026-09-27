import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // If JwtAuthGuard has already run, use userId
    const userId = req.user?.id || req.user?.sub;
    if (userId) {
      return `${req.ip}-${userId}`;
    }

    // If JwtAuthGuard hasn't run but we have a token, use the token as a tracker
    // This allows user-based keying even before the AuthGuard validates the token
    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return `${req.ip}-${authHeader.substring(7)}`;
    }
    
    return req.ip;
  }

  // Override to ensure the response shape is consistent with our global filter
  // although HttpExceptionFilter would catch ThrottlerException, 
  // we can explicitly throw it with a clearer message.
  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    throw new HttpException(
      {
        success: false,
        message: 'Too many requests, please try again later.',
        data: null,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
