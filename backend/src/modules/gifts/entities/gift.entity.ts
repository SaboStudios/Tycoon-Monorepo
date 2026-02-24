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
import { GiftStatus } from '../enums/gift-status.enum';

@Entity({ name: 'gifts' })
@Index(['sender_id', 'status'])
@Index(['receiver_id', 'status'])
@Index(['status', 'expiration'])
@Index(['created_at'])
export class Gift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'sender_id' })
  sender_id: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'int', name: 'receiver_id' })
  receiver_id: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column({ type: 'int', name: 'shop_item_id' })
  shop_item_id: number;

  @ManyToOne(() => ShopItem, { eager: true })
  @JoinColumn({ name: 'shop_item_id' })
  shop_item: ShopItem;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({
    type: 'enum',
    enum: GiftStatus,
    default: GiftStatus.PENDING,
  })
  status: GiftStatus;

  @Column({ type: 'timestamp', nullable: true })
  expiration: Date;

  @Column({ type: 'timestamp', nullable: true })
  accepted_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  rejected_at: Date;

  // Future Web3 support
  @Column({ type: 'varchar', length: 100, nullable: true })
  nft_contract_address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nft_token_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  chain: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transaction_hash: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
