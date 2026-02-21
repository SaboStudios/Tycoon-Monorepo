// src/modules/notifications/entities/notification.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationType {
  // Message-related
  NEW_MESSAGE = 'NEW_MESSAGE',
  MESSAGE_MENTION = 'MESSAGE_MENTION',
  CONVERSATION_INVITE = 'CONVERSATION_INVITE',

  // Transfer-related
  TRANSFER_RECEIVED = 'TRANSFER_RECEIVED',
  TRANSFER_SENT = 'TRANSFER_SENT',
  TRANSFER_COMPLETED = 'TRANSFER_COMPLETED',
  TRANSFER_FAILED = 'TRANSFER_FAILED',

  // System
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  SYSTEM_UPDATE = 'SYSTEM_UPDATE',
  SECURITY_ALERT = 'SECURITY_ALERT',

  // Social
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',
  USER_FOLLOWED = 'USER_FOLLOWED',
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification extends Document {
  @ApiProperty({ enum: NotificationType })
  @Prop({
    required: true,
    type: String,
    enum: NotificationType,
  })
  type: NotificationType;

  @ApiProperty({ description: 'ID of the user receiving this notification' })
  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    index: true,
  })
  recipientId: MongooseSchema.Types.ObjectId;

  @ApiPropertyOptional({ description: 'ID of the user who triggered the notification' })
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  senderId?: MongooseSchema.Types.ObjectId;

  @ApiPropertyOptional()
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    default: null,
  })
  conversationId?: MongooseSchema.Types.ObjectId;

  @ApiPropertyOptional()
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Message',
    default: null,
  })
  messageId?: MongooseSchema.Types.ObjectId;

  @ApiPropertyOptional()
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Transaction',
    default: null,
  })
  transactionId?: MongooseSchema.Types.ObjectId;

  @ApiProperty({ description: 'Human-readable notification message' })
  @Prop({ required: true, type: String, trim: true })
  message: string;

  @ApiProperty({ default: false })
  @Prop({ default: false, index: true })
  isRead: boolean;

  @ApiPropertyOptional({ description: 'Extra contextual data' })
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  metadata?: Record<string, unknown>;

  // Populated by timestamps: true
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Compound index for the most common query: user's unread notifications sorted by date
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
