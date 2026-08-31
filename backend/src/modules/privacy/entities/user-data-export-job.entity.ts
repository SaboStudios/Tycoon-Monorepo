import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type UserDataExportJobStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'failed'
  | 'expired'
  // legacy aliases kept for backward compatibility
  | 'pending'
  | 'processing'
  | 'ready';

@Entity({ name: 'user_data_export_jobs' })
@Index(['user_id', 'created_at'])
export class UserDataExportJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  status: UserDataExportJobStatus;

  @Column({ type: 'text', nullable: true, name: 'file_path' })
  filePath: string | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expiresAt: Date | null;
}
