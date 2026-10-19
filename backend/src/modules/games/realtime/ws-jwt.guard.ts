import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { GameActionError, GameActionErrorCode } from './game-action.error';
import { GamesRealtimeBridge } from './games-realtime.bridge';
import { WsAuthService, WsPrincipal } from './ws-auth.service';

export interface AuthedSocketData {
  principal?: WsPrincipal;
  role?: 'player' | 'spectator';
  gameId?: number;
  seatId?: number;
  terminated?: boolean;
}

export interface AuthedSocket extends Socket {
  data: AuthedSocketData;
}

/**
 * Per-action guard for /games message handlers.
 *
 * The handshake already authenticated the socket (deny-by-default before any
 * room join); this guard re-checks the durable invariants on every action so
 * a token that expired mid-session or a principal banned after connecting is
 * rejected with a stable code instead of being silently dropped.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly realtimeBridge: GamesRealtimeBridge) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthedSocket>();
    const principal = client?.data?.principal;

    if (!principal) {
      throw new WsException(
        new GameActionError(GameActionErrorCode.AUTH_REQUIRED).toPayload(),
      );
    }

    if (client.data.terminated) {
      throw new WsException(
        new GameActionError(GameActionErrorCode.USER_BANNED).toPayload(),
      );
    }

    const termination = this.realtimeBridge.getUserTermination(
      principal.userId,
    );
    if (termination) {
      client.data.terminated = true;
      throw new WsException(
        new GameActionError(GameActionErrorCode.USER_BANNED).toPayload(),
      );
    }

    try {
      WsAuthService.assertNotExpired(principal);
    } catch (err) {
      throw new WsException((err as GameActionError).toPayload());
    }

    return true;
  }
}
