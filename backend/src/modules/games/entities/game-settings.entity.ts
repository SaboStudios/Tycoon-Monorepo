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

@Entity({ name: 'game_settings' })
export class GameSettings {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'int', unsigned: true, unique: true })
  game_id: number;

  @OneToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column({ type: 'boolean', default: true })
  auction: boolean;

  @Column({ type: 'boolean', default: false, name: 'rent_in_prison' })
  rentInPrison: boolean;

  @Column({ type: 'boolean', default: true })
  mortgage: boolean;

  @Column({ type: 'boolean', default: true, name: 'even_build' })
  evenBuild: boolean;

  @Column({ type: 'boolean', default: true, name: 'randomize_play_order' })
  randomizePlayOrder: boolean;

  @Column({ type: 'int', unsigned: true, default: 1500, name: 'starting_cash' })
  startingCash: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
