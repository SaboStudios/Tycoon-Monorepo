import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('game_prize_claims')
@Unique('uq_game_prize_claims_game', ['gameId']) // DB-level backstop: one claim per game
export class GamePrizeClaim {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'game_id', type: 'int' }) gameId: number;
  @Column({ name: 'user_id', type: 'int' }) userId: number;
  @Column({ name: 'idempotency_key', type: 'varchar', length: 64 }) idempotencyKey: string;
  @Column({ type: 'numeric', precision: 38, scale: 0 }) amount: string;
  @CreateDateColumn({ name: 'claimed_at' }) claimedAt: Date;
}