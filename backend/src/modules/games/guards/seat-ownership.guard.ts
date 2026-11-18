import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GamesService } from '../games.service';

const CANONICAL_INTEGER = /^[0-9]+$/;

function parseId(value: unknown, name: string): number {
  if (typeof value !== 'string' || !CANONICAL_INTEGER.test(value)) {
    throw new BadRequestException(`Invalid ${name}`);
  }
  const parsed = BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new BadRequestException(`Invalid ${name}`);
  }
  return Number(parsed);
}

@Injectable()
export class SeatOwnershipGuard implements CanActivate {
  constructor(
    private readonly gamesService: GamesService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const params = request.params ?? {};

    const playerId = parseId(params.playerId, 'playerId');
    const gameId = parseId(params.gameId, 'gameId');

    const user = request.user;
    if (!user) {
      return false;
    }

    return this.gamesService.isSeatOwner(gameId, playerId, user.id);
  }
}
