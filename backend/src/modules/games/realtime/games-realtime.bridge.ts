import { Injectable, Logger } from '@nestjs/common';
import { GameActionErrorCode } from './game-action.error';

/**
 * Terminal reason codes emitted on `game:unsubscribed` before the socket is
 * detached (ADR-002 §6, runbook § Graceful WS unsubscribe).
 */
export type TerminationReason =
  | GameActionErrorCode.USER_BANNED
  | GameActionErrorCode.GAME_ENDED;

export interface GamesRealtimeHandler {
  /** Detach every socket of `userId` across instances (Redis adapter). */
  unsubscribeUser(userId: number, reason: TerminationReason): Promise<void>;
  /** Detach every socket in `gameId`'s room across instances. */
  endGame(gameId: number, reason: TerminationReason): Promise<void>;
}

/**
 * Small signal bus between the REST/admin write paths (ban, force-end) and
 * the WebSocket gateway without a module cycle:
 *
 *   UsersService / GamesService ──▶ bridge ◀── GamesGateway
 *
 * Termination state is tracked per process as a fast path; the durable
 * source of truth stays in Postgres (`users.is_suspended`, `games.status`)
 * so every instance rejects reconnects even without the in-memory entry.
 * Repeated signals are idempotent no-ops (ADR-002 §6.5).
 */
@Injectable()
export class GamesRealtimeBridge {
  private readonly logger = new Logger(GamesRealtimeBridge.name);
  private handler?: GamesRealtimeHandler;

  /** userId -> terminal reason (banned/suspended). */
  private readonly terminatedUsers = new Map<number, TerminationReason>();
  /** gameId -> terminal reason (force-ended). */
  private readonly endedGames = new Map<number, TerminationReason>();

  register(handler: GamesRealtimeHandler): void {
    this.handler = handler;
  }

  unregister(handler: GamesRealtimeHandler): void {
    if (this.handler === handler) {
      this.handler = undefined;
    }
  }

  /**
   * Called from the admin ban/suspension path. Idempotent: a repeat ban for
   * the same user does not emit duplicate terminal events.
   */
  async notifyUserBanned(userId: number): Promise<void> {
    if (this.terminatedUsers.has(userId)) return;
    this.terminatedUsers.set(userId, GameActionErrorCode.USER_BANNED);
    this.logger.log(`User ${userId} banned; detaching game sockets`);
    if (this.handler) {
      await this.handler.unsubscribeUser(
        userId,
        GameActionErrorCode.USER_BANNED,
      );
    }
  }

  /** Called when a ban is lifted so the user may re-handshake. */
  notifyUserRestored(userId: number): void {
    this.terminatedUsers.delete(userId);
  }

  /**
   * Called from the admin force-end path (game status -> FINISHED/CANCELLED).
   * Idempotent: a repeat force-end for the same game is a no-op.
   */
  async notifyGameEnded(gameId: number): Promise<void> {
    if (this.endedGames.has(gameId)) return;
    this.endedGames.set(gameId, GameActionErrorCode.GAME_ENDED);
    this.logger.log(`Game ${gameId} force-ended; detaching room sockets`);
    if (this.handler) {
      await this.handler.endGame(gameId, GameActionErrorCode.GAME_ENDED);
    }
  }

  getUserTermination(userId: number): TerminationReason | undefined {
    return this.terminatedUsers.get(userId);
  }

  getGameTermination(gameId: number): TerminationReason | undefined {
    return this.endedGames.get(gameId);
  }

  /** Test seam: clears all local termination state. */
  reset(): void {
    this.terminatedUsers.clear();
    this.endedGames.clear();
  }
}
