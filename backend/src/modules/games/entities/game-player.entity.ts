import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { GamePlayerSymbol } from '../enums/game-player-symbol.enum';

@Entity({ name: 'game_players' })
@Index(['game_id'])
@Index(['user_id'])
@Index(['game_id', 'user_id'])
export class GamePlayer {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'int', unsigned: true })
  game_id: number;

  @Column({ type: 'int', unsigned: true })
  user_id: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  address: string | null;

  @Column({ type: 'int', default: 1500 })
  balance: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  position: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  turn_order: number | null;

  @Column({
    type: 'enum',
    enum: GamePlayerSymbol,
    nullable: true,
  })
  symbol: GamePlayerSymbol | null;

  @Column({ type: 'boolean', default: false })
  chance_jail_card: boolean;

  @Column({ type: 'boolean', default: false })
  community_chest_jail_card: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ type: 'int', default: 0 })
  rolls: number;

  @Column({ type: 'int', default: 0 })
  circle: number;

  @Column({ type: 'boolean', default: false })
  in_jail: boolean;

  @Column({ type: 'int', unsigned: true, default: 0 })
  in_jail_rolls: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  turn_start: string | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  consecutive_timeouts: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  turn_count: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  last_timeout_turn_start: string | null;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: '0.00',
  })
  trade_locked_balance: string;

  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  rolled: number | null;
}
