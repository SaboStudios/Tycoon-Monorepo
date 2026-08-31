import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index('IDX_TRANSACTIONS_PLAYER_ID')
  playerId: string;

  @Column()
  itemId: string;

  @Column()
  itemName: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @CreateDateColumn()
  @Index('IDX_TRANSACTIONS_CREATED_AT')
  createdAt: Date;
}
