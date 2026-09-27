import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Server-authoritative Board tile engine.
 *
 * Encodes the rules from docs/BOARD_TILE_MODEL.md as a pure module consumed by
 * HTTP/WS actions. The client never supplies economic constants: every quote is
 * derived here and the ruleset is pinned per game via a version + hash so a
 * replay can be rebuilt deterministically.
 */

export const BOARD_TILE_RULESET_VERSION = 'board-tile-model@1';

export type TileKind = 'GO' | 'PROPERTY' | 'RAILROAD' | 'UTILITY' | 'TAX' | 'CHANCE' | 'COMMUNITY' | 'JAIL' | 'FREE_PARKING' | 'GO_TO_JAIL';

export interface TileRule {
  index: number;
  kind: TileKind;
  group?: string;
  price?: number;
  rent?: number[];
  houseCost?: number;
  taxAmount?: number;
}

export interface BoardRuleset {
  version: string;
  hash: string;
  tiles: TileRule[];
}

export interface PlayerState {
  id: string;
  cash: number;
  position: number;
  ownedTiles: number[];
  bankrupt: boolean;
}

export interface GameState {
  id: string;
  ruleset: BoardRuleset;
  players: Record<string, PlayerState>;
  houses: Record<number, number>;
  mortgaged: number[];
}

export interface GameEvent {
  type: string;
  gameId: string;
  playerId: string;
  payload: Record<string, unknown>;
}

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}

export class BoardRuleError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

const DEFAULT_TILES: TileRule[] = [
  { index: 0, kind: 'GO' },
  { index: 1, kind: 'PROPERTY', group: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
  { index: 2, kind: 'COMMUNITY' },
  { index: 3, kind: 'PROPERTY', group: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
  { index: 4, kind: 'TAX', taxAmount: 200 },
  { index: 5, kind: 'RAILROAD', price: 200 },
  { index: 6, kind: 'PROPERTY', group: 'light-blue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { index: 7, kind: 'CHANCE' },
  { index: 8, kind: 'PROPERTY', group: 'light-blue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { index: 9, kind: 'PROPERTY', group: 'light-blue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
  { index: 10, kind: 'JAIL' },
  { index: 11, kind: 'PROPERTY', group: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { index: 12, kind: 'UTILITY', price: 150 },
  { index: 13, kind: 'PROPERTY', group: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { index: 14, kind: 'PROPERTY', group: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
  { index: 15, kind: 'RAILROAD', price: 200 },
  { index: 16, kind: 'PROPERTY', group: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { index: 17, kind: 'COMMUNITY' },
  { index: 18, kind: 'PROPERTY', group: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { index: 19, kind: 'PROPERTY', group: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
  { index: 20, kind: 'FREE_PARKING' },
  { index: 21, kind: 'PROPERTY', group: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { index: 22, kind: 'CHANCE' },
  { index: 23, kind: 'PROPERTY', group: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { index: 24, kind: 'PROPERTY', group: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
  { index: 25, kind: 'RAILROAD', price: 200 },
  { index: 26, kind: 'PROPERTY', group: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { index: 27, kind: 'PROPERTY', group: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { index: 28, kind: 'UTILITY', price: 150 },
  { index: 29, kind: 'PROPERTY', group: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
  { index: 30, kind: 'GO_TO_JAIL' },
  { index: 31, kind: 'PROPERTY', group: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { index: 32, kind: 'PROPERTY', group: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { index: 33, kind: 'COMMUNITY' },
  { index: 34, kind: 'PROPERTY', group: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
  { index: 35, kind: 'RAILROAD', price: 200 },
  { index: 36, kind: 'CHANCE' },
  { index: 37, kind: 'PROPERTY', group: 'dark-blue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
  { index: 38, kind: 'TAX', taxAmount: 100 },
  { index: 39, kind: 'PROPERTY', group: 'dark-blue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 },
];

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

@Injectable()
export class BoardTileService {
  private readonly logger = new Logger(BoardTileService.name);

  /** Build the canonical ruleset with a deterministic content hash. */
  buildRuleset(tiles: TileRule[] = DEFAULT_TILES): BoardRuleset {
    const hash = createHash('sha256')
      .update(stableStringify({ version: BOARD_TILE_RULESET_VERSION, tiles }))
      .digest('hex');
    return { version: BOARD_TILE_RULESET_VERSION, hash, tiles };
  }

  /** Pin the ruleset on a game row; reject client-supplied rulesets. */
  pinRuleset(game: GameState, clientRuleset?: unknown): GameState {
    if (clientRuleset !== undefined) {
      throw new BoardRuleError('CLIENT_RULESET_FORBIDDEN', 'Client may not supply a ruleset');
    }
    if (!game.ruleset || game.ruleset.version !== BOARD_TILE_RULESET_VERSION) {
      return { ...game, ruleset: this.buildRuleset() };
    }
    return game;
  }

  private tile(game: GameState, index: number): TileRule {
    const tile = game.ruleset.tiles[index];
    if (!tile) throw new BoardRuleError('INVALID_TILE', `No tile at index ${index}`);
    return tile;
  }

  private ownsGroup(game: GameState, playerId: string, group: string): boolean {
    const groupTiles = game.ruleset.tiles.filter((t) => t.group === group);
    return groupTiles.length > 0 && groupTiles.every((t) => game.players[playerId]?.ownedTiles.includes(t.index));
  }

  /** Compute rent for landing on a tile. Server is the only source of truth. */
  quoteRent(game: GameState, playerId: string, tileIndex: number, diceTotal: number): number {
    const tile = this.tile(game, tileIndex);
    if (tile.kind === 'TAX') return tile.taxAmount ?? 0;
    if (tile.kind !== 'PROPERTY' && tile.kind !== 'RAILROAD' && tile.kind !== 'UTILITY') return 0;
    const owner = Object.values(game.players).find((p) => p.ownedTiles.includes(tileIndex));
    if (!owner || owner.id === playerId || owner.bankrupt) return 0;
    if (game.mortgaged.includes(tileIndex)) return 0;
    if (tile.kind === 'RAILROAD') {
      const count = owner.ownedTiles.filter((i) => game.ruleset.tiles[i]?.kind === 'RAILROAD').length;
      return 25 * Math.pow(2, Math.max(0, count - 1));
    }
    if (tile.kind === 'UTILITY') {
      const count = owner.ownedTiles.filter((i) => game.ruleset.tiles[i]?.kind === 'UTILITY').length;
      return diceTotal * (count >= 2 ? 10 : 4);
    }
    const houses = game.houses[tileIndex] ?? 0;
    const rent = tile.rent ?? [0];
    if (houses > 0) return rent[Math.min(houses, rent.length - 1)] ?? 0;
    return this.ownsGroup(game, owner.id, tile.group ?? '') ? (rent[0] ?? 0) * 2 : rent[0] ?? 0;
  }

  /**
   * Transactionally apply a money/property mutation and emit replayable events.
   * Fails closed: any rule violation throws before state is mutated.
   */
  apply(game: GameState, playerId: string, action: { type: string; tileIndex?: number; amount?: number; diceTotal?: number }): ApplyResult {
    const player = game.players[playerId];
    if (!player) throw new BoardRuleError('UNKNOWN_PLAYER', `Unknown player ${playerId}`);
    if (player.bankrupt) throw new BoardRuleError('PLAYER_BANKRUPT', 'Bankrupt player cannot act');

    const events: GameEvent[] = [];
    const next: GameState = {
      ...game,
      players: { ...game.players, [playerId]: { ...player } },
      houses: { ...game.houses },
      mortgaged: [...game.mortgaged],
    };
    const actor = next.players[playerId];

    switch (action.type) {
      case 'PAY_RENT': {
        const tileIndex = action.tileIndex ?? actor.position;
        const rent = this.quoteRent(next, playerId, tileIndex, action.diceTotal ?? 0);
        if (rent > 0) {
          const owner = Object.values(next.players).find((p) => p.ownedTiles.includes(tileIndex));
          actor.cash -= rent;
          if (owner) next.players[owner.id] = { ...owner, cash: owner.cash + rent };
          events.push({ type: 'RENT_PAID', gameId: next.id, playerId, payload: { tileIndex, rent, to: owner?.id } });
        }
        break;
      }
      case 'BUY_PROPERTY': {
        const tileIndex = action.tileIndex ?? actor.position;
        const tile = this.tile(next, tileIndex);
        if (tile.price === undefined) throw new BoardRuleError('NOT_PURCHASABLE', 'Tile is not purchasable');
        if (Object.values(next.players).some((p) => p.ownedTiles.includes(tileIndex))) {
          throw new BoardRuleError('ALREADY_OWNED', 'Tile already owned');
        }
        if (actor.cash < tile.price) throw new BoardRuleError('INSUFFICIENT_FUNDS', 'Cannot afford tile');
        actor.cash -= tile.price;
        actor.ownedTiles = [...actor.ownedTiles, tileIndex];
        events.push({ type: 'PROPERTY_BOUGHT', gameId: next.id, playerId, payload: { tileIndex, price: tile.price } });
        break;
      }
      case 'BUILD_HOUSE': {
        const tileIndex = action.tileIndex ?? actor.position;
        const tile = this.tile(next, tileIndex);
        if (tile.kind !== 'PROPERTY' || tile.houseCost === undefined) {
          throw new BoardRuleError('NOT_BUILDABLE', 'Tile cannot host houses');
        }
        if (!actor.ownedTiles.includes(tileIndex)) throw new BoardRuleError('NOT_OWNER', 'Player does not own tile');
        if (!this.ownsGroup(next, playerId, tile.group ?? '')) {
          throw new BoardRuleError('NO_MONOPOLY', 'Cannot build without full color-group monopoly');
        }
        const houses = next.houses[tileIndex] ?? 0;
        if (houses >= 5) throw new BoardRuleError('MAX_HOUSES', 'Tile already has a hotel');
        if (actor.cash < tile.houseCost) throw new BoardRuleError('INSUFFICIENT_FUNDS', 'Cannot afford house');
        actor.cash -= tile.houseCost;
        next.houses[tileIndex] = houses + 1;
        events.push({ type: 'HOUSE_BUILT', gameId: next.id, playerId, payload: { tileIndex, houses: houses + 1 } });
        break;
      }
      case 'SETTLE_DEBT': {
        const amount = action.amount ?? 0;
        if (amount < 0) throw new BoardRuleError('INVALID_AMOUNT', 'Debt amount must be non-negative');
        actor.cash -= amount;
        if (actor.cash < 0) {
          actor.cash = 0;
          actor.bankrupt = true;
          events.push({ type: 'PLAYER_BANKRUPT', gameId: next.id, playerId, payload: { amount } });
        } else {
          events.push({ type: 'DEBT_SETTLED', gameId: next.id, playerId, payload: { amount } });
        }
        break;
      }
      default:
        throw new BoardRuleError('UNKNOWN_ACTION', `Unsupported action ${action.type}`);
    }

    this.logger.debug(`Applied ${action.type} for ${playerId} in game ${next.id}`);
    return { state: next, events };
  }

  /** Rebuild state from an event log; used to verify replay equality. */
  replay(game: GameState, events: GameEvent[]): GameState {
    return events.reduce((state, event) => {
      const result = this.apply(state, event.playerId, {
        type: event.type === 'RENT_PAID' ? 'PAY_RENT' : event.type === 'PROPERTY_BOUGHT' ? 'BUY_PROPERTY' : event.type === 'HOUSE_BUILT' ? 'BUILD_HOUSE' : 'SETTLE_DEBT',
        tileIndex: event.payload.tileIndex as number | undefined,
        amount: event.payload.amount as number | undefined,
        diceTotal: event.payload.diceTotal as number | undefined,
      });
      return result.state;
    }, game);
  }
}
