/**
 * Pure, server-authoritative implementation of the Board tile engine rules
 * described in docs/BOARD_TILE_MODEL.md.
 *
 * This module is intentionally free of framework, IO, and client-trusted
 * constants. HTTP/WS actions must consume these functions and persist the
 * resulting state/events; the client may only render server quotes/results.
 *
 * Ruleset version/hash is pinned per game row so replays and audits are
 * deterministic even if the ruleset evolves.
 */

import { createHash } from 'crypto';

export const BOARD_TILE_MODEL_VERSION = '1.0.0';

/** Canonical, ordered rule constants. Never trust client-supplied values. */
export const BOARD_TILE_MODEL = {
  version: BOARD_TILE_MODEL_VERSION,
  startingCash: 1500,
  goSalary: 200,
  jailFine: 50,
  maxJailTurns: 3,
  houseSupply: 32,
  hotelSupply: 12,
  houseCostRatio: 0.5,
  rentMultipliers: {
    base: 1,
    monopoly: 2,
    house: [1, 2, 3, 4] as readonly number[],
    hotel: 5,
  },
  bankruptcy: {
    // Debt must be settled within this many turns before forced liquidation.
    graceTurns: 1,
  },
  trade: {
    // A pending trade offer expires after this many turns.
    expiryTurns: 3,
  },
} as const;

export type TileKind =
  | 'go'
  | 'property'
  | 'railroad'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'community_chest'
  | 'jail'
  | 'free_parking'
  | 'go_to_jail';

export interface TileDefinition {
  readonly index: number;
  readonly kind: TileKind;
  readonly group?: string;
  readonly price?: number;
  readonly rent?: readonly number[];
  readonly taxAmount?: number;
}

export interface PlayerState {
  readonly id: string;
  readonly cash: number;
  readonly position: number;
  readonly inJail: boolean;
  readonly jailTurns: number;
  readonly bankrupt: boolean;
  readonly properties: readonly number[];
}

export interface PropertyState {
  readonly tileIndex: number;
  readonly ownerId: string | null;
  readonly houses: number;
  readonly hotel: boolean;
  readonly mortgaged: boolean;
}

export interface GameState {
  readonly gameId: string;
  readonly rulesetVersion: string;
  readonly rulesetHash: string;
  readonly players: readonly PlayerState[];
  readonly properties: readonly PropertyState[];
  readonly turn: number;
}

export interface PendingTrade {
  readonly id: string;
  readonly fromPlayerId: string;
  readonly toPlayerId: string;
  readonly offerPropertyIndex: number;
  readonly requestPropertyIndex: number;
  readonly createdTurn: number;
}

export type GameEvent =
  | { type: 'cash_changed'; playerId: string; delta: number; reason: string }
  | { type: 'position_changed'; playerId: string; position: number }
  | { type: 'property_transferred'; tileIndex: number; fromPlayerId: string | null; toPlayerId: string | null }
  | { type: 'houses_changed'; tileIndex: number; houses: number; hotel: boolean }
  | { type: 'player_bankrupt'; playerId: string; creditorId: string | null }
  | { type: 'trade_settled'; tradeId: string; accepted: boolean };

export interface ApplyResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export class BoardRuleError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BoardRuleError';
    this.code = code;
  }
}

/**
 * Deterministic hash of the canonical ruleset. Pinned on each game row so the
 * server can reject replays/actions produced under a different ruleset.
 */
export function computeRulesetHash(): string {
  const canonical = JSON.stringify(BOARD_TILE_MODEL, Object.keys(BOARD_TILE_MODEL).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export const BOARD_TILE_MODEL_HASH = computeRulesetHash();

/**
 * Assert that a game row was created under the current ruleset. Fail-closed:
 * any mismatch is a hard error rather than a silent fallback.
 */
export function assertRulesetPinned(state: Pick<GameState, 'rulesetVersion' | 'rulesetHash'>): void {
  if (state.rulesetVersion !== BOARD_TILE_MODEL_VERSION) {
    throw new BoardRuleError('RULESET_VERSION_MISMATCH', 'game ruleset version is not supported');
  }
  if (state.rulesetHash !== BOARD_TILE_MODEL_HASH) {
    throw new BoardRuleError('RULESET_HASH_MISMATCH', 'game ruleset hash does not match server ruleset');
  }
}

function findPlayer(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new BoardRuleError('PLAYER_NOT_FOUND', `unknown player ${playerId}`);
  }
  return player;
}

function findProperty(state: GameState, tileIndex: number): PropertyState {
  const property = state.properties.find((p) => p.tileIndex === tileIndex);
  if (!property) {
    throw new BoardRuleError('PROPERTY_NOT_FOUND', `unknown property tile ${tileIndex}`);
  }
  return property;
}

function replacePlayer(state: GameState, next: PlayerState): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === next.id ? next : p)),
  };
}

function replaceProperty(state: GameState, next: PropertyState): GameState {
  return {
    ...state,
    properties: state.properties.map((p) => (p.tileIndex === next.tileIndex ? next : p)),
  };
}

/**
 * A player owns a full monopoly of a color group when they own every tile in
 * that group. House/hotel builds are illegal without a monopoly.
 */
export function hasMonopoly(
  state: GameState,
  tiles: readonly TileDefinition[],
  playerId: string,
  group: string,
): boolean {
  const groupTiles = tiles.filter((t) => t.kind === 'property' && t.group === group);
  if (groupTiles.length === 0) return false;
  return groupTiles.every((t) => {
    const prop = state.properties.find((p) => p.tileIndex === t.index);
    return prop?.ownerId === playerId && !prop.mortgaged;
  });
}

/**
 * Compute the rent owed for landing on a tile. Pure function; the server is the
 * only source of truth for economic outcomes.
 */
export function computeRent(
  state: GameState,
  tiles: readonly TileDefinition[],
  tileIndex: number,
  diceTotal: number,
): number {
  const tile = tiles.find((t) => t.index === tileIndex);
  if (!tile) {
    throw new BoardRuleError('TILE_NOT_FOUND', `unknown tile ${tileIndex}`);
  }
  const prop = state.properties.find((p) => p.tileIndex === tileIndex);
  if (!prop || !prop.ownerId || prop.mortgaged) return 0;

  if (tile.kind === 'railroad') {
    const owned = state.properties.filter(
      (p) => tiles.find((t) => t.index === p.tileIndex)?.kind === 'railroad' && p.ownerId === prop.ownerId,
    ).length;
    return 25 * Math.pow(2, Math.max(0, owned - 1));
  }

  if (tile.kind === 'utility') {
    const owned = state.properties.filter(
      (p) => tiles.find((t) => t.index === p.tileIndex)?.kind === 'utility' && p.ownerId === prop.ownerId,
    ).length;
    return diceTotal * (owned >= 2 ? 10 : 4);
  }

  if (tile.kind !== 'property' || !tile.rent) return 0;

  if (prop.hotel) {
    return tile.rent[BOARD_TILE_MODEL.rentMultipliers.hotel] ?? tile.rent[tile.rent.length - 1];
  }
  if (prop.houses > 0) {
    const idx = Math.min(prop.houses, BOARD_TILE_MODEL.rentMultipliers.house.length);
    return tile.rent[idx] ?? tile.rent[tile.rent.length - 1];
  }
  const monopoly = tile.group ? hasMonopoly(state, tiles, prop.ownerId, tile.group) : false;
  return tile.rent[0] * (monopoly ? BOARD_TILE_MODEL.rentMultipliers.monopoly : BOARD_TILE_MODEL.rentMultipliers.base);
}

/**
 * Apply a cash mutation transactionally. Returns a new state plus the event to
 * persist for replay. Never mutates the input state.
 */
export function applyCashDelta(
  state: GameState,
  playerId: string,
  delta: number,
  reason: string,
): ApplyResult {
  assertRulesetPinned(state);
  const player = findPlayer(state, playerId);
  if (player.bankrupt) {
    throw new BoardRuleError('PLAYER_BANKRUPT', 'cannot mutate cash for a bankrupt player');
  }
  const nextCash = player.cash + delta;
  if (nextCash < 0) {
    throw new BoardRuleError('INSUFFICIENT_FUNDS', 'cash mutation would drive balance negative');
  }
  const nextState = replacePlayer(state, { ...player, cash: nextCash });
  return {
    state: nextState,
    events: [{ type: 'cash_changed', playerId, delta, reason }],
  };
}

/**
 * Build a house on a property. Illegal without a monopoly, when the property is
 * mortgaged, when supply is exhausted, or when the build is not even.
 */
export function buildHouse(
  state: GameState,
  tiles: readonly TileDefinition[],
  playerId: string,
  tileIndex: number,
): ApplyResult {
  assertRulesetPinned(state);
  const player = findPlayer(state, playerId);
  const prop = findProperty(state, tileIndex);
  const tile = tiles.find((t) => t.index === tileIndex);
  if (!tile || tile.kind !== 'property' || !tile.group || tile.price === undefined) {
    throw new BoardRuleError('NOT_BUILDABLE', 'tile is not a buildable property');
  }
  if (prop.ownerId !== playerId) {
    throw new BoardRuleError('NOT_OWNER', 'player does not own this property');
  }
  if (prop.mortgaged) {
    throw new BoardRuleError('MORTGAGED', 'cannot build on a mortgaged property');
  }
  if (!hasMonopoly(state, tiles, playerId, tile.group)) {
    throw new BoardRuleError('NO_MONOPOLY', 'illegal house build without monopoly');
  }
  if (prop.hotel) {
    throw new BoardRuleError('MAX_DEVELOPED', 'property already has a hotel');
  }
  const groupTiles = tiles.filter((t) => t.kind === 'property' && t.group === tile.group);
  const minHouses = Math.min(
    ...groupTiles.map((t) => state.properties.find((p) => p.tileIndex === t.index)?.houses ?? 0),
  );
  if (prop.houses > minHouses) {
    throw new BoardRuleError('UNEVEN_BUILD', 'houses must be built evenly across the group');
  }
  const housesInPlay = state.properties.reduce((sum, p) => sum + p.houses, 0);
  if (housesInPlay >= BOARD_TILE_MODEL.houseSupply) {
    throw new BoardRuleError('HOUSE_SUPPLY_EXHAUSTED', 'no houses remaining in supply');
  }
  const cost = Math.round(tile.price * BOARD_TILE_MODEL.houseCostRatio);
  if (player.cash < cost) {
    throw new BoardRuleError('INSUFFICIENT_FUNDS', 'not enough cash to build a house');
  }
  const nextPlayer = { ...player, cash: player.cash - cost };
  const nextProp = { ...prop, houses: prop.houses + 1 };
  const nextState = replaceProperty(replacePlayer(state, nextPlayer), nextProp);
  return {
    state: nextState,
    events: [
      { type: 'cash_changed', playerId, delta: -cost, reason: 'build_house' },
      { type: 'houses_changed', tileIndex, houses: nextProp.houses, hotel: nextProp.hotel },
    ],
  };
}

/**
 * Settle a pending trade. Stale trades (expired by turn) are rejected so a
 * client cannot replay an old accept. Idempotent: a settled trade id is a
 * no-op error rather than a double transfer.
 */
export function settleTrade(
  state: GameState,
  trade: PendingTrade,
  accepted: boolean,
  settledTradeIds: ReadonlySet<string>,
): ApplyResult {
  assertRulesetPinned(state);
  if (settledTradeIds.has(trade.id)) {
    throw new BoardRuleError('TRADE_ALREADY_SETTLED', 'trade has already been settled');
  }
  if (state.turn - trade.createdTurn > BOARD_TILE_MODEL.trade.expiryTurns) {
    throw new BoardRuleError('STALE_TRADE', 'trade offer has expired');
  }
  const from = findPlayer(state, trade.fromPlayerId);
  const to = findPlayer(state, trade.toPlayerId);
  if (from.bankrupt || to.bankrupt) {
    throw new BoardRuleError('PLAYER_BANKRUPT', 'cannot settle a trade with a bankrupt player');
  }
  if (!accepted) {
    return { state, events: [{ type: 'trade_settled', tradeId: trade.id, accepted: false }] };
  }
  const offerProp = findProperty(state, trade.offerPropertyIndex);
  const requestProp = findProperty(state, trade.requestPropertyIndex);
  if (offerProp.ownerId !== from.id || requestProp.ownerId !== to.id) {
    throw new BoardRuleError('TRADE_STALE_OWNERSHIP', 'property ownership changed since offer');
  }
  let nextState = replaceProperty(state, { ...offerProp, ownerId: to.id });
  nextState = replaceProperty(nextState, { ...requestProp, ownerId: from.id });
  return {
    state: nextState,
    events: [
      { type: 'property_transferred', tileIndex: offerProp.tileIndex, fromPlayerId: from.id, toPlayerId: to.id },
      { type: 'property_transferred', tileIndex: requestProp.tileIndex, fromPlayerId: to.id, toPlayerId: from.id },
      { type: 'trade_settled', tradeId: trade.id, accepted: true },
    ],
  };
}

/**
 * Resolve a player who cannot pay a debt. If they cannot cover within the
 * grace window they are declared bankrupt and their assets transfer to the
 * creditor (or the bank when creditorId is null).
 */
export function resolveDebt(
  state: GameState,
  playerId: string,
  amount: number,
  creditorId: string | null,
): ApplyResult {
  assertRulesetPinned(state);
  const player = findPlayer(state, playerId);
  if (player.bankrupt) {
    throw new BoardRuleError('PLAYER_BANKRUPT', 'player is already bankrupt');
  }
  if (player.cash >= amount) {
    const paid = applyCashDelta(state, playerId, -amount, 'debt_payment');
    if (creditorId) {
      const credited = applyCashDelta(paid.state, creditorId, amount, 'debt_received');
      return { state: credited.state, events: [...paid.events, ...credited.events] };
    }
    return paid;
  }
  if (player.jailTurns < BOARD_TILE_MODEL.bankruptcy.graceTurns) {
    throw new BoardRuleError('DEBT_GRACE', 'player is within the bankruptcy grace window');
  }
  const nextPlayer: PlayerState = { ...player, cash: 0, bankrupt: true };
  let nextState = replacePlayer(state, nextPlayer);
  const events: GameEvent[] = [
    { type: 'cash_changed', playerId, delta: -player.cash, reason: 'bankruptcy_liquidation' },
  ];
  for (const prop of state.properties) {
    if (prop.ownerId === playerId) {
      nextState = replaceProperty(nextState, { ...prop, ownerId: creditorId, houses: 0, hotel: false });
      events.push({
        type: 'property_transferred',
        tileIndex: prop.tileIndex,
        fromPlayerId: playerId,
        toPlayerId: creditorId,
      });
    }
  }
  events.push({ type: 'player_bankrupt', playerId, creditorId });
  return { state: nextState, events };
}

/**
 * Table-driven golden vectors for the tile rule family. Used by unit tests and
 * by the games-replay rebuild equality check.
 */
export interface RuleVector {
  readonly name: string;
  readonly run: () => void;
}

export function goldenRuleVectors(): readonly RuleVector[] {
  const baseTiles: readonly TileDefinition[] = [
    { index: 0, kind: 'go' },
    { index: 1, kind: 'property', group: 'brown', price: 60, rent: [2, 10, 30, 90, 160] },
    { index: 3, kind: 'property', group: 'brown', price: 60, rent: [4, 20, 60, 180, 320] },
    { index: 5, kind: 'railroad', price: 200 },
    { index: 12, kind: 'utility', price: 150 },
  ];
  const baseState = (): GameState => ({
    gameId: 'golden',
    rulesetVersion: BOARD_TILE_MODEL_VERSION,
    rulesetHash: BOARD_TILE_MODEL_HASH,
    turn: 1,
    players: [
      { id: 'p1', cash: 1500, position: 0, inJail: false, jailTurns: 0, bankrupt: false, properties: [] },
      { id: 'p2', cash: 1500, position: 0, inJail: false, jailTurns: 0, bankrupt: false, properties: [] },
    ],
    properties: [
      { tileIndex: 1, ownerId: null, houses: 0, hotel: false, mortgaged: false },
      { tileIndex: 3, ownerId: null, houses: 0, hotel: false, mortgaged: false },
      { tileIndex: 5, ownerId: null, houses: 0, hotel: false, mortgaged: false },
      { tileIndex: 12, ownerId: null, houses: 0, hotel: false, mortgaged: false },
    ],
  });

  return [
    {
      name: 'illegal house build without monopoly',
      run: () => {
        const state = baseState();
        state.properties[0].ownerId = 'p1';
        let threw = false;
        try {
          buildHouse(state, baseTiles, 'p1', 1);
        } catch (err) {
          threw = err instanceof BoardRuleError && err.code === 'NO_MONOPOLY';
        }
        if (!threw) throw new Error('expected NO_MONOPOLY');
      },
    },
    {
      name: 'bankruptcy mid-debt transfers assets to creditor',
      run: () => {
        const state = baseState();
        state.players[0].cash = 10;
        state.players[0].jailTurns = BOARD_TILE_MODEL.bankruptcy.graceTurns;
        state.properties[0].ownerId = 'p1';
        const result = resolveDebt(state, 'p1', 500, 'p2');
        const bankrupt = result.state.players.find((p) => p.id === 'p1');
        if (!bankrupt?.bankrupt) throw new Error('expected p1 bankrupt');
        const transferred = result.state.properties.find((p) => p.tileIndex === 1);
        if (transferred?.ownerId !== 'p2') throw new Error('expected asset transfer to creditor');
      },
    },
    {
      name: 'stale trade accept is rejected',
      run: () => {
        const state = baseState();
        state.turn = 10;
        state.properties[0].ownerId = 'p1';
        state.properties[1].ownerId = 'p2';
        let threw = false;
        try {
          settleTrade(
            state,
            {
              id: 't1',
              fromPlayerId: 'p1',
              toPlayerId: 'p2',
              offerPropertyIndex: 1,
              requestPropertyIndex: 3,
              createdTurn: 1,
            },
            true,
            new Set<string>(),
          );
        } catch (err) {
          threw = err instanceof BoardRuleError && err.code === 'STALE_TRADE';
        }
        if (!threw) throw new Error('expected STALE_TRADE');
      },
    },
    {
      name: 'simultaneous duplicate trade accept is idempotent',
      run: () => {
        const state = baseState();
        state.properties[0].ownerId = 'p1';
        state.properties[1].ownerId = 'p2';
        let threw = false;
        try {
          settleTrade(
            state,
            {
              id: 't2',
              fromPlayerId: 'p1',
              toPlayerId: 'p2',
              offerPropertyIndex: 1,
              requestPropertyIndex: 3,
              createdTurn: 1,
            },
            true,
            new Set<string>(['t2']),
          );
        } catch (err) {
          threw = err instanceof BoardRuleError && err.code === 'TRADE_ALREADY_SETTLED';
        }
        if (!threw) throw new Error('expected TRADE_ALREADY_SETTLED');
      },
    },
    {
      name: 'ruleset hash mismatch fails closed',
      run: () => {
        const state = baseState();
        state.rulesetHash = 'deadbeef';
        let threw = false;
        try {
          applyCashDelta(state, 'p1', 10, 'test');
        } catch (err) {
          threw = err instanceof BoardRuleError && err.code === 'RULESET_HASH_MISMATCH';
        }
        if (!threw) throw new Error('expected RULESET_HASH_MISMATCH');
      },
    },
  ];
}
