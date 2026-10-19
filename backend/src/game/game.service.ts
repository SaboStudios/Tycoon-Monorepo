import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { Game } from './entities/game.entity';
import { GameEvent } from './entities/game-event.entity';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';

/**
 * Canonical ruleset definition. This is the single server-side source of truth
 * for board tile rules. It is intentionally pure (no I/O) so it can be consumed
 * by both HTTP and WS game actions and unit-tested with table-driven vectors.
 *
 * See docs/BOARD_TILE_MODEL.md for the human-readable specification.
 */
export interface RulesetDefinition {
  version: string;
  boardSize: number;
  startingCash: number;
  passGoBonus: number;
  jailFine: number;
  maxHousesPerProperty: number;
  houseCostMultiplier: number;
  rentMultiplier: number;
  bankruptcyThreshold: number;
}

export const RULESET_VERSION = '1.0.0';

export const DEFAULT_RULESET: RulesetDefinition = {
  version: RULESET_VERSION,
  boardSize: 40,
  startingCash: 1500,
  passGoBonus: 200,
  jailFine: 50,
  maxHousesPerProperty: 5,
  houseCostMultiplier: 1,
  rentMultiplier: 1,
  bankruptcyThreshold: 0,
};

/**
 * Deterministic serialization of a ruleset so the hash is stable across
 * processes and restarts. Keys are sorted to avoid ordering drift.
 */
export function serializeRuleset(ruleset: RulesetDefinition): string {
  const keys = Object.keys(ruleset).sort() as (keyof RulesetDefinition)[];
  return JSON.stringify(keys.reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = ruleset[key];
    return acc;
  }, {}));
}

/**
 * Compute the canonical ruleset hash. Pinned on every game row so that a game
 * can never be replayed or mutated under a different ruleset than it started
 * with, and so clients cannot supply their own constants.
 */
export function computeRulesetHash(ruleset: RulesetDefinition = DEFAULT_RULESET): string {
  return createHash('sha256').update(serializeRuleset(ruleset)).digest('hex');
}

/**
 * Pure rule helpers. These encode the BOARD_TILE_MODEL rules and are the only
 * place economic outcomes are computed. HTTP/WS handlers must call these
 * instead of trusting client-supplied values.
 */
export function computePassGoBonus(ruleset: RulesetDefinition): number {
  return ruleset.passGoBonus;
}

export function computeJailFine(ruleset: RulesetDefinition): number {
  return ruleset.jailFine;
}

export function computeHouseCost(
  ruleset: RulesetDefinition,
  baseHouseCost: number,
): number {
  return Math.round(baseHouseCost * ruleset.houseCostMultiplier);
}

export function computeRent(
  ruleset: RulesetDefinition,
  baseRent: number,
  houses: number,
): number {
  const safeHouses = Math.max(0, Math.min(houses, ruleset.maxHousesPerProperty));
  return Math.round(baseRent * ruleset.rentMultiplier * (1 + safeHouses));
}

export function isBankrupt(
  ruleset: RulesetDefinition,
  cash: number,
): boolean {
  return cash <= ruleset.bankruptcyThreshold;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(GameEvent)
    private readonly gameEventRepository: Repository<GameEvent>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a game with the ruleset version and hash pinned at creation time.
   * Client-supplied ruleset fields are ignored; the server always uses the
   * canonical DEFAULT_RULESET.
   */
  async createGame(dto: CreateGameDto): Promise<Game> {
    const ruleset = DEFAULT_RULESET;
    const rulesetHash = computeRulesetHash(ruleset);

    const game = this.gameRepository.create({
      ...dto,
      rulesetVersion: ruleset.version,
      rulesetHash,
      settings: {
        ...(dto.settings ?? {}),
        ruleset,
      },
    });

    const saved = await this.gameRepository.save(game);

    await this.gameEventRepository.save(
      this.gameEventRepository.create({
        gameId: saved.id,
        type: 'game.created',
        payload: {
          rulesetVersion: ruleset.version,
          rulesetHash,
        },
      }),
    );

    return saved;
  }

  async findById(id: string): Promise<Game> {
    const game = await this.gameRepository.findOne({ where: { id } });
    if (!game) {
      throw new NotFoundException(`Game ${id} not found`);
    }
    return game;
  }

  /**
   * Resolve the ruleset for a game from its pinned version/hash. Any mismatch
   * between the stored hash and the recomputed hash fails closed so a game can
   * never run under a tampered or drifted ruleset.
   */
  resolveRuleset(game: Game): RulesetDefinition {
    const ruleset = DEFAULT_RULESET;
    const expectedHash = computeRulesetHash(ruleset);

    if (game.rulesetVersion !== ruleset.version) {
      throw new ConflictException(
        `Game ${game.id} ruleset version ${game.rulesetVersion} is not supported`,
      );
    }

    if (game.rulesetHash !== expectedHash) {
      throw new ConflictException(
        `Game ${game.id} ruleset hash mismatch; refusing to proceed`,
      );
    }

    return ruleset;
  }

  /**
   * Update mutable game settings. Ruleset version/hash are immutable and any
   * attempt to override them is rejected. Settings changes are persisted
   * transactionally alongside a replayable game event.
   */
  async updateSettings(id: string, dto: UpdateGameSettingsDto): Promise<Game> {
    if (dto.rulesetVersion !== undefined || dto.rulesetHash !== undefined) {
      throw new BadRequestException('Ruleset version and hash are immutable');
    }

    return this.dataSource.transaction(async (manager) => {
      const game = await manager.findOne(Game, { where: { id } });
      if (!game) {
        throw new NotFoundException(`Game ${id} not found`);
      }

      this.resolveRuleset(game);

      game.settings = {
        ...(game.settings ?? {}),
        ...(dto.settings ?? {}),
      };

      const saved = await manager.save(game);

      await manager.save(
        manager.create(GameEvent, {
          gameId: saved.id,
          type: 'game.settings.updated',
          payload: {
            rulesetVersion: saved.rulesetVersion,
            rulesetHash: saved.rulesetHash,
            settings: dto.settings ?? {},
          },
        }),
      );

      return saved;
    });
  }

  /**
   * Apply a money mutation transactionally. The amount is always derived from
   * the pinned ruleset on the server; callers cannot pass arbitrary deltas.
   */
  async applyPassGo(id: string): Promise<Game> {
    return this.dataSource.transaction(async (manager) => {
      const game = await manager.findOne(Game, { where: { id } });
      if (!game) {
        throw new NotFoundException(`Game ${id} not found`);
      }

      const ruleset = this.resolveRuleset(game);
      const bonus = computePassGoBonus(ruleset);

      game.cash = (game.cash ?? 0) + bonus;
      const saved = await manager.save(game);

      await manager.save(
        manager.create(GameEvent, {
          gameId: saved.id,
          type: 'game.pass_go',
          payload: { bonus, cash: saved.cash },
        }),
      );

      return saved;
    });
  }
}
