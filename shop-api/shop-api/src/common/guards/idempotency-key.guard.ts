import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Validates the `Idempotency-Key` header before the request reaches the handler.
 *
 * Apply at route level:
 *   @UseGuards(IdempotencyKeyGuard)
 *   @Post()
 *   create(...) {}
 *
 * Or globally for all mutating routes via APP_GUARD.
 */
@Injectable()
export class IdempotencyKeyGuard implements CanActivate {
  private static readonly MAX_KEY_LENGTH = 255;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['idempotency-key'];

    if (!key || (typeof key === 'string' && key.trim().length === 0)) {
      throw new BadRequestException('Missing required header: Idempotency-Key');
    }

    const keyStr = Array.isArray(key) ? key[0] : key;

    if (keyStr.length > IdempotencyKeyGuard.MAX_KEY_LENGTH) {
      throw new BadRequestException(
        `Idempotency-Key must be ${IdempotencyKeyGuard.MAX_KEY_LENGTH} characters or fewer`,
      );
    }

    return true;
  }
}
