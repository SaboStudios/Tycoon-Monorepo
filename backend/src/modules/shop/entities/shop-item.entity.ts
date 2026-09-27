import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ShopItemType } from '../enums/shop-item-type.enum';

@Entity({ name: 'shop_items' })
@Index(['type'])
@Index(['rarity'])
@Index(['active'])
export class ShopItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ShopItemType,
  })
  type: ShopItemType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  price: string;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, default: 'common' })
  rarity: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
