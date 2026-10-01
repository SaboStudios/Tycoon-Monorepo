import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, getMetadataArgsStorage, Repository } from 'typeorm';
import { sign } from 'jsonwebtoken';
import { io, Socket } from 'socket.io-client';
import type { AddressInfo } from 'net';

import { jwtConfig } from '../../src/config/jwt.config';
import { gameConfig } from '../../src/config/game.config';
import { redisConfig } from '../../src/config/redis.config';
import { CommonModule } from '../../src/common/common.module';
import { RedisModule } from '../../src/modules/redis/redis.module';
import { RedisService } from '../../src/modules/redis/redis.service';
import { GamesModule } from '../../src/modules/games/games.module';
import { GamesIoAdapter } from '../../src/modules/games/realtime/games-io.adapter';
import { GamesRealtimeBridge } from '../../src/modules/games/realtime/games-realtime.bridge';

import {
  Game,
  GameMode,
  GameStatus,
} from '../../src/modules/games/entities/game.entity';
import { GameSettings } from '../../src/modules/games/entities/game-settings.entity';
import { GamePlayer } from '../../src/modules/games/entities/game-player.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { UserPreference } from '../../src/modules/users/entities/user-preference.entity';
import { BoardStyle } from '../../src/modules/board-styles/entities/board-style.entity';
import { Perk } from '../../src/modules/perks-boosts/entities/perk.entity';
import { ActiveBoost } from '../../src/modules/perks-boosts/entities/active-boost.entity';
import { BoostUsage } from '../../src/modules/perks-boosts/entities/boost-usage.entity';
import { PlayerPerk } from '../../src/modules/perks-boosts/entities/player-perk.entity';
import { PerkAnalyticsEvent } from '../../src/modules/perks-boosts/entities/perk-analytics-event.entity';
import { Notification } from '../../src/modules/fetch-notification/entities/notification.entity';
import { AuditTrail } from '../../src/modules/audit-trail/entities/audit-trail.entity';

const ENTITIES = [
  Game,
  GameSettings,
  GamePlayer,
  User,
  UserPreference,
  BoardStyle,
  Perk,
  ActiveBoost,
  BoostUsage,
  PlayerPerk,
  PerkAnalyticsEvent,
  Notification,
  AuditTrail,
];

/**
 * Postgres-only column types the entity files use are remapped to their
 * better-sqlite3 equivalents before TypeORM builds metadata. The values stay
 * semantically identical for the durations the tests need.
 */
const SQLITE_TYPE_MAP: Record<string, string> = {
  timestamp: 'datetime',
  enum: 'varchar',
  jsonb: 'json',
};

function patchMetadataForSqlite(): void {
  for (const col of getMetadataArgsStorage().columns) {
    const t = (col.options as { type?: unknown } | undefined)?.type;
    if (typeof t === 'string' && SQLITE_TYPE_MAP[t]) {
      (col.options as { type: unknown }).type = SQLITE_TYPE_MAP[t];
    }
  }

  // AuditTrail declares both class-level and property-level indexes for the
  // same column pairs; both resolve to identical generated IDX_ names, which
  // sqlite rejects ("index already exists"). Keep the first of each pair.
  const seen = new Set<string>();
  const indices = getMetadataArgsStorage().indices;
  for (let i = indices.length - 1; i >= 0; i--) {
    const ix = indices[i];
    const target =
      typeof ix.target === 'function'
        ? (ix.target as { name: string }).name
        : String(ix.target);
    const cols = Array.isArray(ix.columns) ? ix.columns.join(',') : '';
    const key = `${target}:${cols}`;
    if (seen.has(key)) indices.splice(i, 1);
    else seen.add(key);
  }
}

/**
 * In-memory stand-in for RedisService. `down = true` reproduces the real
 * service's outage contract: `incrementRateLimit` → 0, `get` → undefined,
 * `set`/`del` swallow the failure. Used to prove the WS idempotency store
 * fails closed (DEPENDENCY_UNAVAILABLE) during a Redis outage.
 */
export class FakeRedisService {
  readonly entries = new Map<
    string,
    { value: unknown; expiresAt: number | null }
  >();
  readonly counters = new Map<string, { count: number; expiresAt: number }>();
  down = false;

  get<T>(key: string): Promise<T | undefined> {
    if (this.down) return Promise.resolve(undefined);
    const entry = this.entries.get(key);
    if (!entry) return Promise.resolve(undefined);
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(entry.value as T);
  }

  set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.down) {
      this.entries.set(key, {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : null,
      });
    }
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    if (!this.down) {
      this.entries.delete(key);
      this.counters.delete(key);
    }
    return Promise.resolve();
  }

  incrementRateLimit(key: string, ttlSeconds = 60): Promise<number> {
    if (this.down) return Promise.resolve(0);
    const now = Date.now();
    const counter = this.counters.get(key);
    if (!counter || counter.expiresAt <= now) {
      this.counters.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
      return Promise.resolve(1);
    }
    counter.count += 1;
    return Promise.resolve(counter.count);
  }
}

export interface SeededUser {
  id: number;
  email: string;
  username: string;
  token: string;
}

export interface SeededGame {
  gameId: number;
  gameCode: string;
  users: [SeededUser, SeededUser];
  seats: [GamePlayer, GamePlayer];
}

export interface ReceivedEvent {
  event: string;
  payload: unknown;
}

export interface GameErrorPayload {
  schemaVersion: number;
  code: string;
  message: string;
  requestId?: string;
}

export interface DiceResult {
  first: number;
  second: number;
  total: number;
}

export interface SnapshotPlayer {
  id: number;
  userId: number;
  username: string | null;
  balance: number;
  position: number;
  circle: number;
  turnOrder: number | null;
  symbol: string | null;
  inJail: boolean;
  inJailRolls: number;
  rolled: boolean;
  rolls: number;
  chanceJailCard?: boolean;
  communityChestJailCard?: boolean;
}

export interface SnapshotGameState {
  id: number;
  code: string;
  status: string;
  mode: string;
  numberOfPlayers: number;
  nextPlayerId: number | null;
  creatorId: number;
}

export interface GameSnapshotPayload {
  schemaVersion: number;
  game: SnapshotGameState;
  players: SnapshotPlayer[];
  viewer: {
    userId: number;
    role: 'player' | 'spectator';
    seatId: number | null;
  };
  replayed?: boolean;
  action?: string;
  dice?: DiceResult;
}

export interface GameStatePayload {
  schemaVersion: number;
  action: string;
  game: SnapshotGameState;
  players: SnapshotPlayer[];
  dice?: DiceResult;
}

export interface GameUnsubscribedPayload {
  schemaVersion: number;
  reason: string;
  code?: string;
  terminal: boolean;
  gameId: number | null;
}

export interface ChatMessagePayload {
  schemaVersion: number;
  gameId: number;
  userId: number;
  seatId: number | null;
  text: string;
  at: string;
}

export interface EventPayloadMap {
  'game:error': GameErrorPayload;
  'game:snapshot': GameSnapshotPayload;
  'game:state': GameStatePayload;
  'game:unsubscribed': GameUnsubscribedPayload;
  'chat:message': ChatMessagePayload;
}

type AnyEventName = keyof EventPayloadMap;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * socket.io test client that records every server event (and disconnects) and
 * lets tests consume matching events with a timeout plus a readable dump of
 * whatever did arrive (keeps failures debuggable).
 */
export class WsTestClient {
  readonly socket: Socket;
  readonly events: ReceivedEvent[] = [];
  readonly disconnectReasons: string[] = [];

  private readonly waiters: Array<{
    event: string;
    predicate: (payload: unknown) => boolean;
    resolve: (payload: unknown) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  constructor(baseUrl: string, token?: string) {
    this.socket = io(`${baseUrl}/games`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 5000,
      auth: token ? { token } : {},
    });
    this.socket.onAny((event: string, ...args: unknown[]) => {
      this.push(event, args[0]);
    });
    this.socket.on('disconnect', (reason: string) => {
      this.disconnectReasons.push(reason);
    });
  }

  private push(event: string, payload: unknown): void {
    const idx = this.waiters.findIndex(
      (w) => w.event === event && w.predicate(payload),
    );
    if (idx >= 0) {
      const [waiter] = this.waiters.splice(idx, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(payload);
      return;
    }
    this.events.push({ event, payload });
  }

  emit(event: string, payload: unknown): void {
    this.socket.emit(event, payload);
  }

  /** Consumes the first matching event (already received or future). */
  take<E extends AnyEventName>(
    event: E,
    predicate: (payload: EventPayloadMap[E]) => boolean = () => true,
    timeoutMs = 5000,
  ): Promise<EventPayloadMap[E]> {
    const matches = (payload: unknown): boolean =>
      predicate(payload as EventPayloadMap[E]);

    const idx = this.events.findIndex(
      (e) => e.event === event && matches(e.payload),
    );
    if (idx >= 0) {
      const [match] = this.events.splice(idx, 1);
      return Promise.resolve(match.payload as EventPayloadMap[E]);
    }
    return new Promise<EventPayloadMap[E]>((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex((w) => w.timer === timer);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for "${event}". ` +
              `Received: ${JSON.stringify(this.events.slice(-10))}` +
              (this.disconnectReasons.length
                ? ` Disconnects: ${this.disconnectReasons.join(', ')}`
                : ''),
          ),
        );
      }, timeoutMs);
      this.waiters.push({
        event,
        predicate: matches,
        resolve: (payload: unknown) => resolve(payload as EventPayloadMap[E]),
        reject,
        timer,
      });
    });
  }

  /** Non-consuming count of matching events received so far. */
  count<E extends AnyEventName>(
    event: E,
    predicate: (payload: EventPayloadMap[E]) => boolean = () => true,
  ): number {
    return this.events.filter(
      (e) => e.event === event && predicate(e.payload as EventPayloadMap[E]),
    ).length;
  }

  waitForConnect(timeoutMs = 5000): Promise<void> {
    if (this.socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for socket connect')),
        timeoutMs,
      );
      this.socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.once('connect_error', (err: Error) => {
        clearTimeout(timer);
        reject(new Error(`connect_error: ${err.message}`));
      });
    });
  }

  waitForDisconnect(timeoutMs = 5000): Promise<string> {
    if (this.disconnectReasons.length > 0) {
      return Promise.resolve(this.disconnectReasons[0]);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for disconnect')),
        timeoutMs,
      );
      this.socket.once('disconnect', (reason: string) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
  }

  close(): void {
    for (const w of this.waiters.splice(0)) {
      clearTimeout(w.timer);
      w.reject(new Error('Client closed while waiting for event'));
    }
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}

export class GamesWsHarness {
  private userSeq = 0;
  private gameSeq = 0;

  constructor(
    readonly app: INestApplication,
    readonly baseUrl: string,
    readonly redis: FakeRedisService,
    readonly bridge: GamesRealtimeBridge,
    readonly dataSource: DataSource,
  ) {}

  get jwtSecret(): string {
    return (
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
    );
  }

  connectClient(token?: string): WsTestClient {
    return new WsTestClient(this.baseUrl, token);
  }

  signToken(
    userId: number,
    claims: { email: string; role: string; is_admin?: boolean },
    expiresIn: number | string = 900,
  ): string {
    return sign(
      {
        sub: userId,
        id: userId,
        email: claims.email,
        role: claims.role,
        is_admin: claims.is_admin ?? false,
      },
      this.jwtSecret,
      { expiresIn },
    );
  }

  async createUser(overrides: Partial<User> = {}): Promise<SeededUser> {
    const n = ++this.userSeq;
    const repo = this.app.get<Repository<User>>(getRepositoryToken(User));
    const user = await repo.save(
      repo.create({
        username: `ws-e2e-user-${n}`,
        email: `ws-e2e-user-${n}@example.test`,
        ...overrides,
      }),
    );
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      token: this.signToken(user.id, {
        email: user.email,
        role: user.role,
        is_admin: user.is_admin ?? false,
      }),
    };
  }

  async createRunningGame(): Promise<SeededGame> {
    const n = ++this.gameSeq;
    const gameRepo = this.app.get<Repository<Game>>(getRepositoryToken(Game));
    const playerRepo = this.app.get<Repository<GamePlayer>>(
      getRepositoryToken(GamePlayer),
    );

    const [u1, u2] = [await this.createUser(), await this.createUser()] as [
      SeededUser,
      SeededUser,
    ];

    const game = await gameRepo.save(
      gameRepo.create({
        code: `E2E-${n}-${Date.now().toString(36).toUpperCase()}`,
        mode: GameMode.PUBLIC,
        status: GameStatus.RUNNING,
        creator_id: u1.id,
        number_of_players: 4,
        next_player_id: u1.id,
      }),
    );
    const seat1 = await playerRepo.save(
      playerRepo.create({ game_id: game.id, user_id: u1.id, turn_order: 1 }),
    );
    const seat2 = await playerRepo.save(
      playerRepo.create({ game_id: game.id, user_id: u2.id, turn_order: 2 }),
    );

    return {
      gameId: game.id,
      gameCode: game.code,
      users: [u1, u2],
      seats: [seat1, seat2],
    };
  }

  async getSeat(gameId: number, userId: number): Promise<GamePlayer | null> {
    const playerRepo = this.app.get<Repository<GamePlayer>>(
      getRepositoryToken(GamePlayer),
    );
    return playerRepo.findOne({ where: { game_id: gameId, user_id: userId } });
  }

  async setGameStatus(gameId: number, status: GameStatus): Promise<void> {
    const gameRepo = this.app.get<Repository<Game>>(getRepositoryToken(Game));
    await gameRepo.update({ id: gameId }, { status });
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}

export async function createHarness(): Promise<GamesWsHarness> {
  patchMetadataForSqlite();
  const fakeRedis = new FakeRedisService();

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        load: [jwtConfig, gameConfig, redisConfig],
      }),
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: ENTITIES,
        synchronize: true,
      }),
      CommonModule,
      RedisModule,
      GamesModule,
    ],
  })
    // Never construct cache-manager's ioredis store in tests: there is no
    // Redis here and the real RedisService is replaced below anyway.
    .overrideProvider(CACHE_MANAGER)
    .useValue({
      get: () => undefined,
      set: () => undefined,
      del: () => undefined,
      reset: () => undefined,
    })
    .overrideProvider(RedisService)
    .useValue(fakeRedis)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useWebSocketAdapter(new GamesIoAdapter(app, undefined));
  await app.listen(0, '127.0.0.1');

  const httpServer = app.getHttpServer() as unknown as {
    address: () => AddressInfo | null;
  };
  const serverAddress = httpServer.address();
  if (!serverAddress || typeof serverAddress === 'string') {
    throw new Error('Harness server did not bind to a TCP port');
  }
  const baseUrl = `ws://127.0.0.1:${serverAddress.port}`;

  return new GamesWsHarness(
    app,
    baseUrl,
    fakeRedis,
    app.get(GamesRealtimeBridge),
    app.get(DataSource),
  );
}
