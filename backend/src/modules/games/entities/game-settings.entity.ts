import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Game } from './game.entity';

/**
 * Game settings entity matching game_settings table DDL.
 * Stores configuration for each game. One-to-one with Game.
 */
@Entity({ name: 'game_settings' })
export class GameSettings {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'int', unsigned: true, name: 'game_id' })
  game_id: number;

  @OneToOne(() => Game, (game) => game.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column({ type: 'boolean', default: false })
  auction: boolean;

  @Column({ type: 'boolean', default: false, name: 'rent_in_prison' })
  rentInPrison: boolean;

  @Column({ type: 'boolean', default: false })
  mortgage: boolean;

  @Column({ type: 'boolean', default: false, name: 'even_build' })
  evenBuild: boolean;

  @Column({ type: 'boolean', default: false, name: 'randomize_play_order' })
  randomizePlayOrder: boolean;

  @Column({
    type: 'int',
    unsigned: true,
    default: 1500,
    name: 'starting_cash',
  })
  startingCash: number;

  @CreateDateColumn({
    type: 'timestamp',
    name: 'created_at',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    name: 'updated_at',
  })
  updated_at: Date;
}
