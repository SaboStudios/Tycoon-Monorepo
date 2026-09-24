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
import { CouponType } from '../enums/coupon-type.enum';
import { ShopItem } from '../../shop/entities/shop-item.entity';

@Entity({ name: 'coupons' })
@Index(['code'], { unique: true })
@Index(['active', 'expiration'])
@Index(['type'])
export class Coupon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({
    type: 'enum',
    enum: CouponType,
  })
  type: CouponType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: string;

  @Column({ type: 'int', nullable: true })
  max_uses: number;

  @Column({ type: 'int', default: 0 })
  current_usage: number;

  @Column({ type: 'timestamp', nullable: true })
  expiration: Date;

  @Column({ type: 'int', nullable: true, name: 'item_restriction_id' })
  item_restriction_id: number;

  @ManyToOne(() => ShopItem, { eager: false, nullable: true })
  @JoinColumn({ name: 'item_restriction_id' })
  item_restriction: ShopItem;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  min_purchase_amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  max_discount_amount: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
