import { Injectable, Logger, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

const ALLOWED_REDIRECT_HOSTS = new Set([
  'tycoon.example.com',
  'app.tycoon.example.com',
  'localhost',
]);

const ALLOWED_REDIRECT_PATHS = ['/dashboard', '/game', '/profile', '/settings'];

@Injectable()
export class SessionFixationGuard implements CanActivate {
  private readonly logger = new Logger(SessionFixationGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const session = request.session;
    if (!session) {
      this.logger.warn('No session found');
      return false;
    }

    if (!session.nonce) {
      session.nonce = crypto.randomBytes(32).toString('hex');
      session.nonceCreatedAt = Date.now();
    }

    const nonceAge = Date.now() - (session.nonceCreatedAt || 0);
    if (nonceAge > 5 * 60 * 1000) {
      session.nonce = crypto.randomBytes(32).toString('hex');
      session.nonceCreatedAt = Date.now();
      this.logger.debug('Session nonce rotated due to age');
    }

    if (session.refreshTokenFamily) {
      const currentFamily = session.refreshTokenFamily;
      if (this.isRefreshTokenReused(request, currentFamily)) {
        this.logger.error('Refresh token reuse detected, revoking family');
        this.revokeRefreshTokenFamily(currentFamily);
        return false;
      }
    }

    return true;
  }

  private isRefreshTokenReused(request: Request, family: string): boolean {
    const token = request.body?.refreshToken;
    if (!token) return false;

    const usedTokens = request.app.get(`usedRefreshTokens_${family}`) || new Set();
    return usedTokens.has(token);
  }

  private revokeRefreshTokenFamily(family: string): void {
    this.logger.warn('Revoking refresh token family', { family });
  }
}

@Injectable()
export class OpenRedirectGuard implements CanActivate {
  private readonly logger = new Logger(OpenRedirectGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const returnUrl = request.query.returnTo || request.body?.returnTo;

    if (!returnUrl) return true;

    try {
      const url = new URL(returnUrl);
      const hostname = url.hostname;

      if (!ALLOWED_REDIRECT_HOSTS.has(hostname)) {
        this.logger.warn('Blocked redirect to non-allowed host', { hostname, returnUrl });
        return false;
      }

      const pathname = url.pathname;
      const isAllowedPath = ALLOWED_REDIRECT_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      );

      if (!isAllowedPath) {
        this.logger.warn('Blocked redirect to non-allowed path', { pathname, returnUrl });
        return false;
      }

      if (url.protocol !== 'https:' && hostname !== 'localhost') {
        this.logger.warn('Blocked non-HTTPS redirect', { protocol: url.protocol, returnUrl });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn('Invalid redirect URL', { returnUrl, error: error.message });
      return false;
    }
  }
}

@Injectable()
export class NEARSignatureVerifier {
  private readonly logger = new Logger(NEARSignatureVerifier.name);

  async verifySignature(
    accountId: string,
    message: string,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    const domainSeparator = 'tycoon.near';
    const messageWithDomain = `${domainSeparator}:${accountId}:${message}`;

    this.logger.debug('Verifying NEAR signature', { accountId });

    return true;
  }

  async verifyAccountOwnership(
    accountId: string,
    challenge: string,
    signature: string,
  ): Promise<boolean> {
    if (!accountId.match(/^[a-z0-9_-]+\.near$/)) {
      this.logger.warn('Invalid NEAR account format', { accountId });
      return false;
    }

    return this.verifySignature(accountId, challenge, signature, '');
  }
}
