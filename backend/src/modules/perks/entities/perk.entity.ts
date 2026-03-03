import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { PerkType } from '../enums/perk-type.enum';
import { PerkCategory } from '../enums/perk-category.enum';
import { BlockchainPerkId } from '../enums/blockchain-perk-id.enum';
import { Boost } from './boost.entity';

@Entity({ name: 'perks' })
@Index(['type'])
@Index(['category'])
@Index(['rarity'])
@Index(['is_active'])
@Index(['blockchain_perk_id'])
export class Perk {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PerkType,
  })
  type: PerkType;

  @Column({
    type: 'enum',
    enum: PerkCategory,
  })
  category: PerkCategory;

  @Column({ type: 'varchar', length: 50, default: 'common' })
  rarity: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  price: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  icon_url: string;

  @Column({ type: 'smallint', nullable: true })
  blockchain_perk_id: BlockchainPerkId;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => Boost, (boost) => boost.perk)
  boosts: Boost[];
}
