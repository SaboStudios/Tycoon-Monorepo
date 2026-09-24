import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { SkinCategory } from '../enums/skin-category.enum';
import { SkinRarity } from '../enums/skin-rarity.enum';

@Entity({ name: 'skins' })
@Index(['category'])
@Index(['rarity'])
export class Skin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({
    type: 'enum',
    enum: SkinCategory,
  })
  category: SkinCategory;

  @Column({
    type: 'enum',
    enum: SkinRarity,
    default: SkinRarity.COMMON,
  })
  rarity: SkinRarity;

  @Column({ type: 'boolean', default: false })
  is_premium: boolean;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  price: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  preview_image: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
