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
import { Skin } from './skin.entity';

@Entity({ name: 'user_skins' })
@Index(['user_id', 'skin_id'], { unique: true })
export class UserSkin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unsigned: true })
  user_id: number;

  @Column({ type: 'int', unsigned: true })
  skin_id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Skin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skin_id' })
  skin: Skin;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlocked_at: Date;
}
