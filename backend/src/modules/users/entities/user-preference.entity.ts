import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';
import { BoardStyle } from '../../board-styles/entities/board-style.entity';

@Entity({ name: 'user_preferences' })
export class UserPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unsigned: true })
  user_id: number;

  @OneToOne(() => User, (user) => user.preference, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', unsigned: true, nullable: true })
  board_style_id: number;

  @ManyToOne(() => BoardStyle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'board_style_id' })
  boardStyle: BoardStyle;

  @Column({ type: 'json', nullable: true })
  settings: Record<string, any>;

  @UpdateDateColumn()
  updated_at: Date;
}
