// src/modules/fetch-notification/entities/notification.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  NEW_MESSAGE = 'new_message',
  MENTION = 'mention',
  TOKEN_RECEIVED = 'token_received',
  SYSTEM = 'system',
  ALERT = 'alert',
}

@Entity('notifications')
@Index('idx_notifications_user_unread', ['userId', 'isRead']) // composite — most common query pattern
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index('idx_notifications_user_id')
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  @Index('idx_notifications_type')
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'is_read', default: false })
  @Index('idx_notifications_is_read')
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
