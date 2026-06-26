import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  /** Emitted when RedisService cache set succeeds (gated by CACHE_AUDIT_ENABLED). */
  CACHE_SET = 'CACHE_SET',
  /** Emitted when RedisService cache del succeeds (gated by CACHE_AUDIT_ENABLED). */
  CACHE_DEL = 'CACHE_DEL',
  /** Emitted when RedisService delByPattern removes one or more keys (gated by CACHE_AUDIT_ENABLED). */
  CACHE_INVALIDATE = 'CACHE_INVALIDATE',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_SOFT_DELETED = 'USER_SOFT_DELETED',
  USER_RESTORED = 'USER_RESTORED',
  USER_HARD_DELETED = 'USER_HARD_DELETED',
  METRICS_SCRAPED = 'METRICS_SCRAPED',
  HEALTH_CHECK_ACCESSED = 'HEALTH_CHECK_ACCESSED',
  UPLOAD_CREATED = 'UPLOAD_CREATED',
  UPLOAD_DELETED = 'UPLOAD_DELETED',

  // Game Lifecycle
  /** Emitted when a new game is created */
  GAME_CREATED = 'GAME_CREATED',
  /** Emitted when a game is updated (status, winner, placements, etc.) */
  GAME_UPDATED = 'GAME_UPDATED',
  /** Emitted when game settings are updated */
  GAME_SETTINGS_UPDATED = 'GAME_SETTINGS_UPDATED',
  /** Emitted when a game is viewed (gated by GAMES_AUDIT_LOG_VIEWS) */
  GAME_VIEWED = 'GAME_VIEWED',
  /** Emitted when games are searched/filtered */
  GAME_SEARCHED = 'GAME_SEARCHED',

  // Matchmaking
  /** Emitted when a player successfully joins a game */
  GAME_JOINED = 'GAME_JOINED',
  /** Emitted when a player fails to join a game */
  GAME_JOIN_FAILED = 'GAME_JOIN_FAILED',
  /** Emitted when a player leaves a game */
  GAME_LEFT = 'GAME_LEFT',

  // Player Actions
  /** Emitted when a player rolls dice */
  PLAYER_DICE_ROLLED = 'PLAYER_DICE_ROLLED',
  /** Emitted when a player pays rent */
  PLAYER_RENT_PAID = 'PLAYER_RENT_PAID',
  /** Emitted when a player pays tax */
  PLAYER_TAX_PAID = 'PLAYER_TAX_PAID',
  /** Emitted when a player buys property */
  PLAYER_PROPERTY_BOUGHT = 'PLAYER_PROPERTY_BOUGHT',
  /** Emitted when a player's state is updated */
  PLAYER_UPDATED = 'PLAYER_UPDATED',
  SHOP_ITEM_CREATED = 'SHOP_ITEM_CREATED',
  SHOP_ITEM_UPDATED = 'SHOP_ITEM_UPDATED',
  SHOP_ITEM_DELETED = 'SHOP_ITEM_DELETED',
  PURCHASE_CREATED = 'PURCHASE_CREATED',
  GIFT_SENT = 'GIFT_SENT',

  // Webhook lifecycle (SW-BE — audit trail hooks)
  /** Emitted when a webhook is received */
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
  /** Emitted when a webhook signature is successfully verified */
  WEBHOOK_SIGNATURE_VERIFIED = 'WEBHOOK_SIGNATURE_VERIFIED',
  /** Emitted when a webhook signature verification fails */
  WEBHOOK_SIGNATURE_FAILED = 'WEBHOOK_SIGNATURE_FAILED',
  /** Emitted when a duplicate webhook is detected (idempotency hit) */
  WEBHOOK_DUPLICATE = 'WEBHOOK_DUPLICATE',
  /** Emitted when a webhook is successfully processed */
  WEBHOOK_PROCESSED = 'WEBHOOK_PROCESSED',
  /** Emitted when webhook processing fails */
  WEBHOOK_FAILED = 'WEBHOOK_FAILED',
}

@Entity({ name: 'audit_trails' })
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
@Index(['userId', 'action'])
export class AuditTrail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  action: AuditAction;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail: string;

  @Column({ type: 'int', nullable: true })
  performedBy: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  performedByEmail: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
