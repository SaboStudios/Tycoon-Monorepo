import {
  BOARD_TILE_MODEL_VERSION,
  BOARD_TILE_MODEL_HASH,
  BoardTileModel,
  TileKind,
  BoardTileError,
  BoardTileErrorCode,
  GameStateSnapshot,
  TileRuleVector,
} from './board-tile-model';

/**
 * Table-driven golden vectors for the BOARD_TILE_MODEL tile rule family.
 *
 * These vectors are the server-side source of truth for economic outcomes:
 * money, property, house builds, bankruptcy, trades and simultaneous actions.
 * The client must never be able to override any of these results.
 */

const baseState = (overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot => ({
  gameId: 'game-1',
  rulesetVersion: BOARD_TILE_MODEL_VERSION,
  rulesetHash: BOARD_TILE_MODEL_HASH,
  turn: 1,
  activePlayerId: 'p1',
  players: {
    p1: { id: 'p1', cash: 1500, position: 0, bankrupt: false, properties: [] },
    p2: { id: 'p2', cash: 1500, position: 0, bankrupt: false, properties: [] },
  },
  board: {
    tiles: [
      { index: 0, kind: TileKind.Go },
      { index: 1, kind: TileKind.Property, group: 'brown', price: 60, houseCost: 50 },
      { index: 2, kind: TileKind.Property, group: 'brown', price: 60, houseCost: 50 },
      { index: 3, kind: TileKind.Property, group: 'lightblue', price: 100, houseCost: 50 },
      { index: 4, kind: TileKind.Tax, amount: 200 },
      { index: 5, kind: TileKind.Chance },
    ],
  },
  ...overrides,
});

interface Vector {
  name: string;
  state: GameStateSnapshot;
  action: TileRuleVector['action'];
  expect: {
    ok: boolean;
    code?: BoardTileErrorCode;
    cash?: Record<string, number>;
    owner?: Record<number, string | null>;
    houses?: Record<number, number>;
    events?: string[];
  };
}

const vectors: Vector[] = [
  {
    name: 'buy property debits cash and assigns owner',
    state: baseState(),
    action: { type: 'buy', playerId: 'p1', tileIndex: 1 },
    expect: { ok: true, cash: { p1: 1440 }, owner: { 1: 'p1' }, events: ['property.bought'] },
  },
  {
    name: 'illegal house build without monopoly is rejected',
    state: baseState({
      players: {
        p1: { id: 'p1', cash: 1500, position: 0, bankrupt: false, properties: [1] },
        p2: { id: 'p2', cash: 1500, position: 0, bankrupt: false, properties: [] },
      },
    }),
    action: { type: 'buildHouse', playerId: 'p1', tileIndex: 1 },
    expect: { ok: false, code: BoardTileErrorCode.NoMonopoly },
  },
  {
    name: 'house build allowed with full monopoly and sufficient cash',
    state: baseState({
      players: {
        p1: { id: 'p1', cash: 1500, position: 0, bankrupt: false, properties: [1, 2] },
        p2: { id: 'p2', cash: 1500, position: 0, bankrupt: false, properties: [] },
      },
    }),
    action: { type: 'buildHouse', playerId: 'p1', tileIndex: 1 },
    expect: { ok: true, cash: { p1: 1450 }, houses: { 1: 1 }, events: ['house.built'] },
  },
  {
    name: 'bankruptcy mid-debt settles to creditor and marks player bankrupt',
    state: baseState({
      players: {
        p1: { id: 'p1', cash: 10, position: 0, bankrupt: false, properties: [1] },
        p2: { id: 'p2', cash: 1500, position: 0, bankrupt: false, properties: [] },
      },
    }),
    action: { type: 'payDebt', playerId: 'p1', creditorId: 'p2', amount: 200 },
    expect: { ok: true, cash: { p1: 0, p2: 1510 }, owner: { 1: 'p2' }, events: ['player.bankrupt'] },
  },
  {
    name: 'stale trade accept is rejected',
    state: baseState(),
    action: { type: 'acceptTrade', playerId: 'p2', tradeId: 'trade-1', expectedVersion: 3, currentVersion: 4 },
    expect: { ok: false, code: BoardTileErrorCode.StaleTrade },
  },
  {
    name: 'simultaneous duplicate action is idempotent',
    state: baseState(),
    action: { type: 'buy', playerId: 'p1', tileIndex: 1, idempotencyKey: 'k-1' },
    expect: { ok: true, cash: { p1: 1440 }, owner: { 1: 'p1' }, events: ['property.bought'] },
  },
  {
    name: 'client-supplied ruleset hash mismatch is rejected',
    state: baseState({ rulesetHash: 'deadbeef' }),
    action: { type: 'buy', playerId: 'p1', tileIndex: 1 },
    expect: { ok: false, code: BoardTileErrorCode.RulesetMismatch },
  },
  {
    name: 'tax tile debits active player',
    state: baseState(),
    action: { type: 'resolveTile', playerId: 'p1', tileIndex: 4 },
    expect: { ok: true, cash: { p1: 1300 }, events: ['tax.paid'] },
  },
];

describe('BOARD_TILE_MODEL server-side enforcement', () => {
  it('pins a stable ruleset version and hash', () => {
    expect(BOARD_TILE_MODEL_VERSION).toBeGreaterThan(0);
    expect(BOARD_TILE_MODEL_HASH).toMatch(/^[0-9a-f]{8,}$/);
  });

  describe.each(vectors)('$name', (vector) => {
    it('produces the golden server result', () => {
      const model = new BoardTileModel();
      const result = model.apply(vector.state, vector.action);

      expect(result.ok).toBe(vector.expect.ok);

      if (!vector.expect.ok) {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe(vector.expect.code);
        }
        return;
      }

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      if (vector.expect.cash) {
        for (const [playerId, cash] of Object.entries(vector.expect.cash)) {
          expect(result.state.players[playerId].cash).toBe(cash);
        }
      }
      if (vector.expect.owner) {
        for (const [tileIndex, owner] of Object.entries(vector.expect.owner)) {
          expect(result.state.board.tiles[Number(tileIndex)].ownerId ?? null).toBe(owner);
        }
      }
      if (vector.expect.houses) {
        for (const [tileIndex, houses] of Object.entries(vector.expect.houses)) {
          expect(result.state.board.tiles[Number(tileIndex)].houses ?? 0).toBe(houses);
        }
      }
      if (vector.expect.events) {
        expect(result.events.map((e) => e.type)).toEqual(vector.expect.events);
      }
    });
  });

  it('is idempotent for duplicate simultaneous actions', () => {
    const model = new BoardTileModel();
    const state = baseState();
    const action = { type: 'buy' as const, playerId: 'p1', tileIndex: 1, idempotencyKey: 'dup-1' };

    const first = model.apply(state, action);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = model.apply(first.state, action);
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.state.players.p1.cash).toBe(first.state.players.p1.cash);
    expect(second.events).toHaveLength(0);
  });

  it('never trusts client-supplied economic constants', () => {
    const model = new BoardTileModel();
    const state = baseState();
    const result = model.apply(state, {
      type: 'buy',
      playerId: 'p1',
      tileIndex: 1,
      // adversarial client payload attempting to override price
      price: 0,
    } as TileRuleVector['action']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.p1.cash).toBe(1440);
  });

  it('fails closed when the ruleset hash does not match the pinned game row', () => {
    const model = new BoardTileModel();
    const result = model.apply(baseState({ rulesetHash: 'tampered' }), {
      type: 'buy',
      playerId: 'p1',
      tileIndex: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(BoardTileError);
    expect(result.error.code).toBe(BoardTileErrorCode.RulesetMismatch);
  });
});
