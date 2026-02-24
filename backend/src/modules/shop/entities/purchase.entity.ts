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
import { Coupon } from '../../coupons/entities/coupon.entity';

@Entity({ name: 'purchases' })
@Index(['user_id'])
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

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  original_price: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  final_price: string;

  @Column({ type: 'int', nullable: true, name: 'coupon_id' })
  coupon_id: number;

  @ManyToOne(() => Coupon, { eager: false, nullable: true })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon;

  @Column({ type: 'varchar', length: 50, nullable: true })
  coupon_code: string;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 50, default: 'completed' })
  status: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
