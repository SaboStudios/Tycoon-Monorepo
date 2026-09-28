import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpMetricsService } from '../../metrics/http-metrics.service';
import { Game } from '../entities/game.entity';
import { GamesService } from '../games.service';
import { GameCodeLookupErrorCode, normalizeGameCode } from './game-code';
import {
  GameCodeLookupCaller,
  GameCodeRateLimiterService,
} from './game-code-rate-limiter.service';

/**
 * Resolves a game by code for an authenticated caller whose attempt has
 * already been counted by GameCodeLookupGuard. Malformed and unknown codes
 * both count as misses toward the lockout; the 404 never echoes the input.
 */
@Injectable()
export class GameCodeLookupService {
  constructor(
    private readonly gamesService: GamesService,
    private readonly limiter: GameCodeRateLimiterService,
    private readonly metrics: HttpMetricsService,
  ) {}

  async lookup(rawCode: unknown, caller: GameCodeLookupCaller): Promise<Game> {
    let code: string;
    try {
      code = normalizeGameCode(rawCode);
    } catch (err) {
      await this.limiter.recordMiss(caller);
      this.metrics.recordGameCodeLookup('invalid');
      throw err;
    }

    try {
      const game = await this.gamesService.findByCode(code);
      this.metrics.recordGameCodeLookup('found');
      return game;
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
      await this.limiter.recordMiss(caller);
      this.metrics.recordGameCodeLookup('not_found');
      throw new NotFoundException({
        message: 'Game not found',
        code: GameCodeLookupErrorCode.GAME_NOT_FOUND,
      });
    }
  }
}
