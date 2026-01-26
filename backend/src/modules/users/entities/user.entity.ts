import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'users' })
@Index(['address', 'chain'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  address: string;

  @Column({ type: 'varchar', length: 50, default: 'BASE' })
  chain: string;

  @Column({ type: 'int', default: 0 })
  games_played: number;

  @Column({ type: 'int', default: 0 })
  game_won: number;

  @Column({ type: 'int', default: 0 })
  game_lost: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
  })
  total_staked: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
  })
  total_earned: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: 0,
  })
  total_withdrawn: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}