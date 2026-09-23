import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Cookie name used by the REST JWT strategy (see ADR-004).
 * Kept in sync so WebSocket handshakes parse the same token source as REST.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Extract a bearer token from the Authorization header, if present.
 * Mirrors the REST JWT strategy's header parsing.
 */
export function extractBearerToken(
  authorization?: string | null,
): string | undefined {
  if (!authorization) {
    return undefined;
  }
  const [scheme, token] = authorization.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return undefined;
  }
  return token;
}

/**
 * Parse a JWT from the same sources used by the REST JWT strategy:
 * the httpOnly auth cookie first, then the Authorization header.
 * Used by both HTTP guards and the WebSocket handshake for parity.
 */
export function extractJwtFromRequest(
  request: Pick<Request, 'headers' | 'cookies'>,
): string | undefined {
  const cookieToken = request.cookies?.[ACCESS_TOKEN_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  return extractBearerToken(request.headers?.authorization);
}

/**
 * JwtAuthGuard - Use this guard to protect routes that require JWT authentication.
 * Apply with @UseGuards(JwtAuthGuard) decorator.
 *
 * Token resolution matches the REST JWT strategy (cookie or bearer header)
 * so WebSocket handshakes and HTTP routes authenticate identically.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext): Request {
    return context.switchToHttp().getRequest<Request>();
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    // Deny-by-default: unauthenticated sockets/requests never receive a user.
    if (err || !user) {
      throw err instanceof Error ? err : new Error('Unauthorized');
    }
    return user;
  }
}
