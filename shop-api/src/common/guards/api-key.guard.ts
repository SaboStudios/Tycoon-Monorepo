import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Authenticates `POST /purchases` with either:
 *   1. An API key sent in the `x-api-key` header (matches `SHOP_API_KEY`), or
 *   2. A valid Bearer JWT (`Authorization: Bearer <token>`) verified with
 *      `JWT_SECRET`.
 *
 * Requests without valid credentials receive 401. Keys/tokens are never logged.
 *
 * Apply alongside the idempotency guard, and list this guard FIRST so
 * unauthenticated requests get 401 before any other validation:
 *   @UseGuards(ApiKeyAuthGuard, IdempotencyKeyGuard)
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1) API key.
    const apiKey = request.headers['x-api-key'];
    const expectedApiKey = process.env.SHOP_API_KEY;
    if (
      expectedApiKey &&
      typeof apiKey === 'string' &&
      this.safeEqual(apiKey, expectedApiKey)
    ) {
      return true;
    }

    // 2) Bearer JWT — only attempted when a secret is configured.
    const authorization = request.headers['authorization'];
    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ') &&
      process.env.JWT_SECRET
    ) {
      const token = authorization.slice('Bearer '.length);
      try {
        await this.jwtService.verifyAsync(token);
        return true;
      } catch {
        // Invalid/expired token — fall through to 401. Never log the token.
      }
    }

    throw new UnauthorizedException(
      'Authentication required. Provide an `x-api-key` header or a valid Bearer JWT.',
    );
  }

  /** Constant-time comparison to avoid timing side-channels on the API key. */
  private safeEqual(provided: string, expected: string): boolean {
    try {
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
