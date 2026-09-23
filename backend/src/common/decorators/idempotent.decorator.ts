import {
  CallHandler,
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Marks a route as idempotent. The Idempotency-Key header is required and is
 * bound to a hash of the request body so that replays return the stored
 * response while payload conflicts fail closed with 409.
 *
 * The authoritative write path is shop-api; this decorator only guards the
 * backend proxy/read model so it never becomes a second source of truth for
 * money or inventory.
 */
export const IDEMPOTENT_KEY = 'tycoon:idempotent';
export const IDEMPOTENT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Game actions (roll/buy/end-turn) are submitted as intents over the WS
 * gateway. Reconnect retries and duplicate tabs can replay the same intent, so
 * the idempotency key is scoped per game action and bound to the acting seat.
 */
export const GAME_ACTION_IDEMPOTENCY_SCOPE = 'game-action';

/**
 * Bankruptcy winner determination and prize claim are money-moving actions.
 * They are scoped separately from ordinary game actions so a prize claim can
 * never be replayed as (or collide with) a roll/buy/end-turn intent, and so the
 * winner-only authorization is enforced on a dedicated key namespace.
 */
export const BANKRUPTCY_PRIZE_CLAIM_IDEMPOTENCY_SCOPE = 'bankruptcy-prize-claim';

export type GameActionType = 'roll' | 'buy' | 'end-turn';

export interface GameActionIntent {
  gameId: string;
  seatId: string;
  action: GameActionType;
  /** Client-generated key; stable across reconnect retries of the same intent. */
  idempotencyKey: string;
  payload?: unknown;
}

/**
 * Intent for claiming the bankruptcy winner prize. The winner seat is the only
 * seat authorized to submit this intent; the server re-derives the winner from
 * the pinned ruleset and never trusts the client-supplied seatId for the
 * economic outcome.
 */
export interface BankruptcyPrizeClaimIntent {
  gameId: string;
  /** Seat submitting the claim; must match the server-determined winner. */
  seatId: string;
  /** Pinned ruleset version/hash the claim was computed against. */
  rulesetVersion: string;
  /** Client-generated key; stable across reconnect retries of the same claim. */
  idempotencyKey: string;
  payload?: unknown;
}

export interface IdempotencyRecord {
  bodyHash: string;
  status: number;
  response: unknown;
  expiresAt: number;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | undefined>;
  set(key: string, record: IdempotencyRecord): Promise<void>;
}

/**
 * In-memory fallback store. Production deployments should provide a Redis-backed
 * implementation via the IDEMPOTENCY_STORE token so replays survive restarts and
 * are shared across replicas.
 */
export const IDEMPOTENCY_STORE = 'tycoon:idempotency-store';

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const record = this.records.get(key);
    if (!record) {
      return undefined;
    }
    if (record.expiresAt <= Date.now()) {
      this.records.delete(key);
      return undefined;
    }
    return record;
  }

  async set(key: string, record: IdempotencyRecord): Promise<void> {
    this.records.set(key, record);
  }
}

export function hashRequestBody(body: unknown): string {
  const canonical = JSON.stringify(body ?? null);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Builds the store key for a game action intent. The key is namespaced by game
 * and seat so a spectator or a different seat cannot replay another player's
 * intent, and so the same client key across games never collides.
 */
export function gameActionIdempotencyKey(intent: GameActionIntent): string {
  return [
    GAME_ACTION_IDEMPOTENCY_SCOPE,
    intent.gameId,
    intent.seatId,
    intent.action,
    intent.idempotencyKey,
  ].join(':');
}

/**
 * Canonical hash of a game action intent. Excludes the idempotency key itself
 * (it is part of the store key) so a replay with the same key and same intent
 * matches, while a reused key with a different action/payload fails closed.
 */
export function hashGameActionIntent(intent: GameActionIntent): string {
  return hashRequestBody({
    gameId: intent.gameId,
    seatId: intent.seatId,
    action: intent.action,
    payload: intent.payload ?? null,
  });
}

/**
 * Builds the store key for a bankruptcy prize claim. Namespaced by game and
 * seat so a non-winner seat cannot replay the winner's claim, and so the same
 * client key across games never collides.
 */
export function bankruptcyPrizeClaimIdempotencyKey(
  intent: BankruptcyPrizeClaimIntent,
): string {
  return [
    BANKRUPTCY_PRIZE_CLAIM_IDEMPOTENCY_SCOPE,
    intent.gameId,
    intent.seatId,
    intent.idempotencyKey,
  ].join(':');
}

/**
 * Canonical hash of a bankruptcy prize claim intent. Excludes the idempotency
 * key itself (it is part of the store key) so a replay with the same key and
 * same claim matches, while a reused key with a different ruleset version or
 * payload fails closed. The ruleset version is included so a claim computed
 * against a stale ruleset cannot be silently replayed after a ruleset bump.
 */
export function hashBankruptcyPrizeClaimIntent(
  intent: BankruptcyPrizeClaimIntent,
): string {
  return hashRequestBody({
    gameId: intent.gameId,
    seatId: intent.seatId,
    rulesetVersion: intent.rulesetVersion,
    payload: intent.payload ?? null,
  });
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: IdempotencyStore,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const key = request.headers?.['idempotency-key'];

    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for this operation.',
      });
    }

    const bodyHash = hashRequestBody(request.body);
    const existing = await this.store.get(key);

    if (existing) {
      if (existing.bodyHash !== bodyHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
          message: 'Idempotency-Key was reused with a different payload.',
        });
      }
      return of(existing.response);
    }

    return next.handle().pipe(
      tap((response) => {
        void this.store.set(key, {
          bodyHash,
          status: 200,
          response,
          expiresAt: Date.now() + IDEMPOTENT_TTL_MS,
        });
      }),
    );
  }
}

/**
 * Route decorator that enforces Idempotency-Key semantics on the wrapped
 * handler. Requires IdempotencyInterceptor to be registered globally or on the
 * controller.
 */
export function Idempotent(): MethodDecorator & ClassDecorator {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      SetMetadata(IDEMPOTENT_KEY, true)(target, key as string | symbol, descriptor);
      UseInterceptors(IdempotencyInterceptor)(target, key as string | symbol, descriptor);
      return;
    }
    SetMetadata(IDEMPOTENT_KEY, true)(target);
    UseInterceptors(IdempotencyInterceptor)(target);
  };
}
