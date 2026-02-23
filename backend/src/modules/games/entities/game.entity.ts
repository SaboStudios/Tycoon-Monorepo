import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { GameSettings } from './game-settings.entity';

/**
 * Enum for game mode
 */
export enum GameMode {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

/**
 * Enum for game status
 */
export enum GameStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

/**
 * Interface for placements JSON structure
 * This can be extended based on actual game requirements
 */
export interface GamePlacements {
  [playerId: number]: number;
}

/**
 * Game entity representing the games table
 * Maps all columns from the DDL with proper TypeScript types and decorators
 */
@Entity({ name: 'games' })
@Index('idx_games_status', ['status'])
@Index('idx_games_creator_id', ['creator_id'])
@Index('idx_games_mode', ['mode'])
@Index('idx_games_is_ai', ['is_ai'])
@Index('idx_games_is_minipay', ['is_minipay'])
@Index('idx_games_chain', ['chain'])
export class Game {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true, name: 'code' })
  code: string;

  @Column({
    type: 'enum',
    enum: GameMode,
    default: GameMode.PUBLIC,
  })
  mode: GameMode;

  @Column({ type: 'int', unsigned: true, name: 'creator_id' })
  creator_id: number;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.PENDING,
  })
  status: GameStatus;

  @Column({ type: 'int', unsigned: true, nullable: true, name: 'winner_id' })
  winner_id: number | null;

  @Column({
    type: 'int',
    unsigned: true,
    default: 4,
    name: 'number_of_players',
  })
  number_of_players: number;

  @Column({
    type: 'int',
    unsigned: true,
    nullable: true,
    name: 'next_player_id',
  })
  next_player_id: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ type: 'boolean', default: false, name: 'is_ai' })
  is_ai: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_minipay' })
  is_minipay: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  chain: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  duration: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  started_at: Date | null;

  @Column({
    type: 'varchar',
    length: 78,
    nullable: true,
    name: 'contract_game_id',
  })
  contract_game_id: string | null;

  @Column({
    type: 'json',
    nullable: true,
  })
  placements: GamePlacements | null;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'winner_id' })
  winner: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'next_player_id' })
  nextPlayer: User | null;

  @OneToOne(() => GameSettings, (settings) => settings.game, {
    cascade: true,
    eager: true,
  })
  settings: GameSettings;
}
