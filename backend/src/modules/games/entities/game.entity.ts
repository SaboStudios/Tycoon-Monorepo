import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum GameStatus {
  PENDING = 'pending',
  STARTED = 'started',
  ENDED = 'ended',
}

@Entity({ name: 'games' })
export class Game {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 50, default: 'PUBLIC' })
  mode: string;

  @Column({ type: 'int', unsigned: true, default: 4, name: 'number_of_players' })
  numberOfPlayers: number;

  @Column({ type: 'varchar', length: 50, default: GameStatus.PENDING })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
