import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'waitlist' })
export class Waitlist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  wallet_address: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email_address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  telegram_username: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
