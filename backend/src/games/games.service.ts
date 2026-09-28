import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { TradeOffer, TradeOfferStatus } from './entities/trade-offer.entity';
import { GameEvent } from './entities/game-event.entity';
import { Property } from './entities/property.entity';

/**
 * Pure ruleset for trade offer expiry and atomic accept.
 * Encodes the rules from docs/BOARD_TILE_MODEL.md so HTTP/WS actions
 * share a single source of truth. Never trust client-supplied constants.
 */
export const TRADE_RULESET_VERSION = 'trade-ruleset-v1';

export interface TradeRuleset {
  version: string;
  /** Offers expire after this many milliseconds. */
  offerTtlMs: number;
  /** Maximum cash that may change hands in a single trade. */
  maxCashAmount: number;
}

export const TRADE_RULESET: TradeRuleset = {
  version: TRADE_RULESET_VERSION,
  offerTtlMs: 5 * 60 * 1000,
  maxCashAmount: 1_000_000,
};

/**
 * Pure predicate: is the offer expired relative to `now`?
 * Expiry is inclusive of the boundary (>= ttl).
 */
export function isTradeOfferExpired(
  offer: { createdAt: Date | string; status: TradeOfferStatus },
  now: Date = new Date(),
  ruleset: TradeRuleset = TRADE_RULESET,
): boolean {
  if (offer.status !== TradeOfferStatus.PENDING) {
    return false;
  }
  const created = offer.createdAt instanceof Date ? offer.createdAt : new Date(offer.createdAt);
  return now.getTime() - created.getTime() >= ruleset.offerTtlMs;
}

/**
 * Pure validation of a trade offer payload against the ruleset.
 * Returns an error string when invalid, or null when acceptable.
 */
export function validateTradeOffer(
  offer: { cashAmount: number; propertyIds: string[] },
  ruleset: TradeRuleset = TRADE_RULESET,
): string | null {
  if (!Number.isInteger(offer.cashAmount) || offer.cashAmount < 0) {
    return 'cashAmount must be a non-negative integer';
  }
  if (offer.cashAmount > ruleset.maxCashAmount) {
    return `cashAmount exceeds maximum of ${ruleset.maxCashAmount}`;
  }
  if (!Array.isArray(offer.propertyIds)) {
    return 'propertyIds must be an array';
  }
  if (new Set(offer.propertyIds).size !== offer.propertyIds.length) {
    return 'propertyIds must not contain duplicates';
  }
  return null;
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    @InjectRepository(Game)
    private readonly gamesRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private readonly playersRepository: Repository<GamePlayer>,
    @InjectRepository(TradeOffer)
    private readonly tradeOffersRepository: Repository<TradeOffer>,
    @InjectRepository(GameEvent)
    private readonly gameEventsRepository: Repository<GameEvent>,
    @InjectRepository(Property)
    private readonly propertiesRepository: Repository<Property>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a trade offer. Ruleset version is pinned on the game row so
   * later accepts are evaluated against the same ruleset.
   */
  async createTradeOffer(
    gameId: string,
    fromPlayerId: string,
    toPlayerId: string,
    cashAmount: number,
    propertyIds: string[],
  ): Promise<TradeOffer> {
    const game = await this.gamesRepository.findOne({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const validationError = validateTradeOffer({ cashAmount, propertyIds });
    if (validationError) {
      throw new BadRequestException(validationError);
    }

    const fromPlayer = await this.playersRepository.findOne({
      where: { id: fromPlayerId, gameId },
    });
    if (!fromPlayer) {
      throw new ForbiddenException('Offering player is not part of this game');
    }

    const toPlayer = await this.playersRepository.findOne({
      where: { id: toPlayerId, gameId },
    });
    if (!toPlayer) {
      throw new ForbiddenException('Receiving player is not part of this game');
    }

    if (fromPlayer.cash < cashAmount) {
      throw new BadRequestException('Offering player has insufficient cash');
    }

    if (propertyIds.length > 0) {
      const owned = await this.propertiesRepository.find({
        where: propertyIds.map((id) => ({ id, ownerId: fromPlayerId, gameId })),
      });
      if (owned.length !== propertyIds.length) {
        throw new BadRequestException('Offering player does not own all offered properties');
      }
    }

    // Pin the ruleset version on the game row; never trust client constants.
    if (game.rulesetVersion !== TRADE_RULESET.version) {
      game.rulesetVersion = TRADE_RULESET.version;
      await this.gamesRepository.save(game);
    }

    const offer = this.tradeOffersRepository.create({
      gameId,
      fromPlayerId,
      toPlayerId,
      cashAmount,
      propertyIds,
      status: TradeOfferStatus.PENDING,
      rulesetVersion: TRADE_RULESET.version,
      createdAt: new Date(),
    });

    return this.tradeOffersRepository.save(offer);
  }

  /**
   * Atomically accept a trade offer.
   *
   * Idempotent: concurrent duplicate requests and reconnect retries must not
   * double-apply. Expired offers are rejected. All money/property mutations
   * happen inside a single transaction and emit a game event for replay.
   */
  async acceptTradeOffer(
    gameId: string,
    offerId: string,
    acceptingPlayerId: string,
  ): Promise<TradeOffer> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the offer row so concurrent accepts serialize.
      const offer = await manager.findOne(TradeOffer, {
        where: { id: offerId, gameId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!offer) {
        throw new NotFoundException('Trade offer not found');
      }

      // Idempotency: an already-accepted offer returns the same result
      // instead of re-applying economic mutations.
      if (offer.status === TradeOfferStatus.ACCEPTED) {
        return offer;
      }

      if (offer.status !== TradeOfferStatus.PENDING) {
        throw new ConflictException('Trade offer is no longer pending');
      }

      if (offer.toPlayerId !== acceptingPlayerId) {
        throw new ForbiddenException('Only the receiving player may accept this offer');
      }

      // Evaluate expiry against the ruleset pinned on the offer/game row.
      const ruleset: TradeRuleset = {
        ...TRADE_RULESET,
        version: offer.rulesetVersion ?? TRADE_RULESET.version,
      };
      if (isTradeOfferExpired(offer, new Date(), ruleset)) {
        offer.status = TradeOfferStatus.EXPIRED;
        await manager.save(offer);
        throw new ConflictException('Trade offer has expired');
      }

      const fromPlayer = await manager.findOne(GamePlayer, {
        where: { id: offer.fromPlayerId, gameId },
        lock: { mode: 'pessimistic_write' },
      });
      const toPlayer = await manager.findOne(GamePlayer, {
        where: { id: offer.toPlayerId, gameId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromPlayer || !toPlayer) {
        throw new NotFoundException('Trade participants not found');
      }

      // Re-validate against current state; fail closed on writes.
      if (fromPlayer.cash < offer.cashAmount) {
        throw new BadRequestException('Offering player no longer has sufficient cash');
      }

      if (offer.propertyIds.length > 0) {
        const owned = await manager.find(Property, {
          where: offer.propertyIds.map((id) => ({
            id,
            ownerId: offer.fromPlayerId,
            gameId,
          })),
        });
        if (owned.length !== offer.propertyIds.length) {
          throw new BadRequestException('Offering player no longer owns all offered properties');
        }
      }

      // Apply money mutation.
      fromPlayer.cash -= offer.cashAmount;
      toPlayer.cash += offer.cashAmount;
      await manager.save(fromPlayer);
      await manager.save(toPlayer);

      // Apply property mutation.
      if (offer.propertyIds.length > 0) {
        await manager
          .createQueryBuilder()
          .update(Property)
          .set({ ownerId: offer.toPlayerId })
          .where('id IN (:...ids)', { ids: offer.propertyIds })
          .andWhere('gameId = :gameId', { gameId })
          .execute();
      }

      offer.status = TradeOfferStatus.ACCEPTED;
      offer.acceptedAt = new Date();
      const saved = await manager.save(offer);

      // Emit a game event for replay.
      const event = manager.create(GameEvent, {
        gameId,
        type: 'trade.accepted',
        payload: {
          offerId: offer.id,
          fromPlayerId: offer.fromPlayerId,
          toPlayerId: offer.toPlayerId,
          cashAmount: offer.cashAmount,
          propertyIds: offer.propertyIds,
          rulesetVersion: ruleset.version,
        },
        createdAt: new Date(),
      });
      await manager.save(event);

      this.logger.log(
        `Trade offer ${offer.id} accepted in game ${gameId} (ruleset ${ruleset.version})`,
      );

      return saved;
    });
  }

  /**
   * Expire stale pending offers for a game. Safe to call from a scheduler or
   * on reconnect; idempotent because it only transitions PENDING -> EXPIRED.
   */
  async expireStaleTradeOffers(gameId: string): Promise<number> {
    const pending = await this.tradeOffersRepository.find({
      where: { gameId, status: TradeOfferStatus.PENDING },
    });

    const now = new Date();
    const stale = pending.filter((offer) => isTradeOfferExpired(offer, now));
    if (stale.length === 0) {
      return 0;
    }

    for (const offer of stale) {
      offer.status = TradeOfferStatus.EXPIRED;
    }
    await this.tradeOffersRepository.save(stale);
    return stale.length;
  }
}
