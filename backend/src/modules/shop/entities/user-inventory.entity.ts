import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ShopItem } from '../../shop/entities/shop-item.entity';

@Entity({ name: 'user_inventory' })
@Index(['user_id', 'shop_item_id'], { unique: true })
@Index(['user_id'])
@Index(['shop_item_id'])
@Index(['expires_at'])
export class UserInventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', name: 'shop_item_id' })
  shop_item_id: number;

  @ManyToOne(() => ShopItem, { eager: true })
  @JoinColumn({ name: 'shop_item_id' })
  shop_item: ShopItem;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expires_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
