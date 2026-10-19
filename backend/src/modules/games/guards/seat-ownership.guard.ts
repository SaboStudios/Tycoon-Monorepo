import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { GamePlayersService } from '../game-players.service';

interface AuthenticatedRequest extends Request {
  user?: { id: number; role?: string; is_admin?: boolean };
}

/**
 * Seat-ownership guard for game mutation routes.
 *
 * A non-admin caller may only act for the seat (`GamePlayer` row) they own;
 * admins may act for any seat (moderation/repair tooling). Resolves the seat
 * from `:playerId` (or `:id`) and, when present, scopes it to `:gameId` so a
 * player id from another game cannot be used as a confused deputy.
 *
 * Must be paired with JwtAuthGuard so `req.user` is populated.
 */
@Injectable()
export class SeatOwnershipGuard implements CanActivate {
  constructor(private readonly gamePlayersService: GamePlayersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const params = req.params ?? {};
    const playerId = Number(params.playerId ?? params.id);
    const gameId =
      params.gameId !== undefined ? Number(params.gameId) : undefined;

    const seat =
      gameId !== undefined && Number.isFinite(gameId)
        ? await this.gamePlayersService.findByGameAndPlayer(gameId, playerId)
        : await this.gamePlayersService.findOne(playerId);

    if (seat.user_id === user.id || user.is_admin || user.role === 'admin') {
      return true;
    }

    throw new NotFoundException('Seat not found for your account in this game');
  }
}
