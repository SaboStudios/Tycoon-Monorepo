import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Perk } from './perk.entity';

@Entity({ name: 'boosts' })
@Index(['perk_id'])
@Index(['boost_type'])
export class Boost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'perk_id' })
  perk_id: number;

  @ManyToOne(() => Perk, (perk) => perk.boosts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'perk_id' })
  perk: Perk;

  @Column({ type: 'varchar', length: 100 })
  boost_type: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 4,
  })
  effect_value: string;

  @Column({ type: 'int', nullable: true })
  duration_seconds: number;

  @Column({ type: 'boolean', default: false })
  stackable: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
