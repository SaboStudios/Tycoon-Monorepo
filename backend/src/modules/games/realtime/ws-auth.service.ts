import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { User } from '../../users/entities/user.entity';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { GamesRealtimeBridge } from './games-realtime.bridge';
import { GameActionError, GameActionErrorCode } from './game-action.error';

/**
 * Verified identity attached to an authenticated socket. `exp` is epoch
 * seconds from the JWT so expiry can be re-checked on every action
 * (auth expiry mid-session must reject with AUTH_EXPIRED).
 */
export interface WsPrincipal {
  userId: number;
  role: string;
  isAdmin: boolean;
  exp: number;
}

export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Handshake authentication for the /games namespace (ADR-002 §1).
 *
 * Token precedence mirrors REST parity (ADR-004 chain):
 *   1. `access_token` cookie
 *   2. `Authorization: Bearer <token>` header
 *   3. `auth.token` handshake auth field (native clients)
 *
 * Deny-by-default: missing/malformed/expired tokens, suspended users and
 * banned principals are rejected before the socket is accepted. The verified
 * principal is the only source of identity for later events — client-supplied
 * query/userId fields are never trusted.
 */
@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly realtimeBridge: GamesRealtimeBridge,
  ) {}

  extractToken(client: Socket): string | undefined {
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const token = WsAuthService.parseCookie(
        cookieHeader,
        ACCESS_TOKEN_COOKIE,
      );
      if (token) return token;
    }

    const authHeader = client.handshake.headers.authorization;
    if (typeof authHeader === 'string') {
      const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
      if (match) return match[1];
    }

    const handshakeAuth = client.handshake.auth as
      | { token?: unknown }
      | undefined;
    if (handshakeAuth && typeof handshakeAuth.token === 'string') {
      return handshakeAuth.token;
    }

    return undefined;
  }

  static parseCookie(cookieHeader: string, name: string): string | undefined {
    for (const part of cookieHeader.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      if (part.slice(0, eq).trim() !== name) continue;
      const raw = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
    return undefined;
  }

  /**
   * Verify the handshake and load the durable account state. Throws
   * GameActionError with a stable code so the gateway can relay it before
   * closing the socket.
   */
  async authenticate(client: Socket): Promise<WsPrincipal> {
    const token = this.extractToken(client);
    if (!token) {
      throw new GameActionError(GameActionErrorCode.AUTH_REQUIRED, {
        message: 'Authentication token missing',
      });
    }

    let payload: JwtPayload & { exp?: number };
    try {
      payload = this.jwtService.verify<JwtPayload & { exp?: number }>(token);
    } catch (err) {
      const message = (err as Error)?.message ?? '';
      this.logger.warn(`WS handshake rejected: ${message}`);
      throw new GameActionError(GameActionErrorCode.AUTH_REQUIRED, {
        message: 'Authentication token invalid or expired',
      });
    }

    const userId = Number(payload?.sub ?? payload?.id);
    if (!Number.isFinite(userId)) {
      throw new GameActionError(GameActionErrorCode.AUTH_REQUIRED, {
        message: 'Authentication token subject missing',
      });
    }

    // Banned principals fail closed on every (re)connect, even with a
    // still-valid token, until the ban is lifted.
    const termination = this.realtimeBridge.getUserTermination(userId);
    if (termination) {
      throw new GameActionError(GameActionErrorCode.USER_BANNED, {
        message: 'This account cannot join games',
      });
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'role', 'is_admin', 'is_suspended'],
    });
    if (!user) {
      throw new GameActionError(GameActionErrorCode.AUTH_REQUIRED, {
        message: 'Account no longer exists',
      });
    }
    if (user.is_suspended) {
      throw new GameActionError(GameActionErrorCode.USER_BANNED, {
        message: 'This account has been suspended',
      });
    }

    return {
      userId,
      role: user.role,
      isAdmin: user.is_admin ?? false,
      exp:
        typeof payload.exp === 'number'
          ? payload.exp
          : Math.floor(Date.now() / 1000) + 900,
    };
  }

  /**
   * Re-checked on every action: an expired token mid-session rejects with
   * AUTH_EXPIRED and requires a fresh handshake.
   */
  static assertNotExpired(principal: WsPrincipal): void {
    if (principal.exp * 1000 <= Date.now()) {
      throw new GameActionError(GameActionErrorCode.AUTH_EXPIRED, {
        message: 'Token expired; refresh and re-handshake',
      });
    }
  }
}
