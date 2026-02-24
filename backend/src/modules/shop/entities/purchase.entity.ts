import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ShopItem } from './shop-item.entity';

@Entity({ name: 'purchases' })
@Index(['user_id', 'created_at'])
@Index(['shop_item_id'])
@Index(['created_at'])
export class Purchase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  user_id: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', name: 'shop_item_id' })
  shop_item_id: number;

  @ManyToOne(() => ShopItem, { eager: true })
  @JoinColumn({ name: 'shop_item_id' })
  shop_item: ShopItem;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  unit_price: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  total_price: string;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 50, default: 'balance' })
  payment_method: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transaction_id: string;

  @Column({ type: 'boolean', default: false })
  is_gift: boolean;

  @Column({ type: 'int', nullable: true })
  gift_id: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
