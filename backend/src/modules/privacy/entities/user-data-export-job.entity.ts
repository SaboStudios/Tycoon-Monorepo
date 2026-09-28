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
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'expired';

@Entity({ name: 'user_data_export_jobs' })
@Index(['userId', 'createdAt'])
// At most one active export per user; concurrent/duplicate requests collapse
// onto it (see UserDataExportService.requestExport and migration
// 1759000000000-AddActiveUserDataExportUniqueIndex).
@Index('UQ_user_data_export_jobs_active_user', ['userId'], {
  unique: true,
  where: `"status" IN ('pending', 'processing')`,
})
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

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expiresAt: Date | null;
}
