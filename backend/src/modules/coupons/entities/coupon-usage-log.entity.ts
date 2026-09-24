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
import { Coupon } from './coupon.entity';
import { Purchase } from '../../shop/entities/purchase.entity';

@Entity({ name: 'coupon_usage_logs' })
@Index(['coupon_id', 'created_at'])
@Index(['user_id', 'created_at'])
@Index(['purchase_id'])
export class CouponUsageLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'coupon_id' })
  coupon_id: number;

  @ManyToOne(() => Coupon, { eager: false })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon;

  @Column({ type: 'int', name: 'user_id' })
  user_id: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', nullable: true, name: 'purchase_id' })
  purchase_id: number;

  @ManyToOne(() => Purchase, { eager: false, nullable: true })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @Column({ type: 'varchar', length: 50 })
  coupon_code: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  original_amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discount_amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  final_amount: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address: string;

  @Column({ type: 'text', nullable: true })
  user_agent: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
