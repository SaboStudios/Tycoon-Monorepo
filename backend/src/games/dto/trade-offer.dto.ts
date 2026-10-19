import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Trade offer lifecycle states.
 *
 * A trade offer is created in `PENDING`, may be `ACCEPTED` or `REJECTED` by the
 * counterparty, or `EXPIRED` once its server-issued deadline elapses. Terminal
 * states (`ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`) are immutable.
 */
export enum TradeOfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

/**
 * A single asset (cash or property) moving from one player to another as part
 * of a trade. Amounts are validated server-side against the authoritative game
 * state; the client only proposes intent.
 */
export class TradeAssetDto {
  @IsEnum(['CASH', 'PROPERTY'] as const)
  kind!: 'CASH' | 'PROPERTY';

  /** Cash amount in the game's smallest currency unit. Required for CASH. */
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  /** Board tile id of the property. Required for PROPERTY. */
  @IsOptional()
  @IsInt()
  @Min(0)
  tileId?: number;
}

/**
 * Request body for creating a trade offer.
 *
 * `rulesetVersion` is the server-pinned ruleset hash the client observed when
 * rendering the board. The server rejects offers whose ruleset does not match
 * the game row so economic outcomes can never be driven by stale client
 * constants.
 */
export class CreateTradeOfferDto {
  @IsUUID()
  gameId!: string;

  @IsUUID()
  fromPlayerId!: string;

  @IsUUID()
  toPlayerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradeAssetDto)
  offered!: TradeAssetDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradeAssetDto)
  requested!: TradeAssetDto[];

  /** Server-pinned ruleset hash; must match the game row. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  rulesetVersion!: string;

  /**
   * Client-generated idempotency key. Concurrent duplicate submissions and
   * reconnect retries reuse the same key so the server applies the offer at
   * most once.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}

/**
 * Request body for accepting a trade offer.
 *
 * Acceptance is atomic and idempotent: the server re-validates the offer is
 * still `PENDING` and unexpired at the moment of the transaction, applies all
 * money/property mutations in a single transaction, and emits replayable game
 * events. A duplicate accept with the same `idempotencyKey` returns the
 * original result instead of double-applying.
 */
export class AcceptTradeOfferDto {
  @IsUUID()
  gameId!: string;

  @IsUUID()
  offerId!: string;

  @IsUUID()
  playerId!: string;

  /** Server-pinned ruleset hash; must match the game row. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  rulesetVersion!: string;

  /** Idempotency key for concurrent duplicate accepts / reconnect retries. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}

/**
 * Request body for rejecting or cancelling a trade offer. Both are idempotent
 * and only valid while the offer is `PENDING` and unexpired.
 */
export class RejectTradeOfferDto {
  @IsUUID()
  gameId!: string;

  @IsUUID()
  offerId!: string;

  @IsUUID()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}

/**
 * Server-issued view of a trade offer. Clients render this verbatim and never
 * finalize economic outcomes locally.
 */
export class TradeOfferViewDto {
  @IsUUID()
  offerId!: string;

  @IsUUID()
  gameId!: string;

  @IsUUID()
  fromPlayerId!: string;

  @IsUUID()
  toPlayerId!: string;

  @IsEnum(TradeOfferStatus)
  status!: TradeOfferStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradeAssetDto)
  offered!: TradeAssetDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TradeAssetDto)
  requested!: TradeAssetDto[];

  /** Server-pinned ruleset hash for the owning game row. */
  @IsString()
  rulesetVersion!: string;

  /** ISO-8601 deadline; after this instant the offer is EXPIRED. */
  @IsString()
  expiresAt!: string;

  @IsBoolean()
  expired!: boolean;
}
