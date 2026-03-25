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

@Entity('user_suspensions')
@Index(['userId'])
@Index(['isActive'])
export class UserSuspension {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @Column({ type: 'int', name: 'suspended_by' })
  suspendedBy: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'suspended_at' })
  suspendedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'unsuspended_at' })
  unsuspendedAt: Date | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'suspended_by' })
  admin: User;
}
