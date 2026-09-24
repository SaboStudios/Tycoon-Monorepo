import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Canonical ruleset identifiers. The server is the sole source of truth for
 * economic outcomes; clients must never supply or override these values.
 */
export const RULESET_VERSION = 'board-tile-model@1';

/**
 * Deterministic hash of the BOARD_TILE_MODEL ruleset (see
 * docs/BOARD_TILE_MODEL.md). Pinned per game row so replays and audits can
 * verify which rule family produced a given outcome.
 */
export const RULESET_HASH =
  'sha256:0000000000000000000000000000000000000000000000000000000000000000';

export type GameStatus =
  | 'lobby'
  | 'active'
  | 'paused'
  | 'finished'
  | 'abandoned';

@Entity('games')
@Index(['rulesetVersion', 'rulesetHash'])
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  roomCode: string;

  @Column({ type: 'varchar', length: 32, default: 'lobby' })
  status: GameStatus;

  /**
   * Ruleset version pinned at game creation. Immutable for the lifetime of
   * the game so mid-game rule changes cannot alter economic outcomes.
   */
  @Column({ type: 'varchar', length: 64, default: RULESET_VERSION })
  rulesetVersion: string;

  /**
   * Ruleset hash pinned at game creation. Used to reject client-supplied
   * constants and to validate event-sourced replays.
   */
  @Column({ type: 'varchar', length: 128, default: RULESET_HASH })
  rulesetHash: string;

  /**
   * Server-owned game settings (starting cash, house/rent multipliers, etc.).
   * Persisted as JSONB so the pure rules module can consume it without
   * trusting any client payload.
   */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  settings: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  hostUserId: string | null;

  @Column({ type: 'int', default: 0 })
  turnNumber: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
