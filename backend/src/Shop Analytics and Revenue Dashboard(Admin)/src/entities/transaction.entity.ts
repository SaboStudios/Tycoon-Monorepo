import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  playerId: string;

  @Column()
  itemId: string;

  @Column()
  itemName: string;

  @Column("decimal", { precision: 10, scale: 2 })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;
}
