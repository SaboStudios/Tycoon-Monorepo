// src/modules/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationType } from './entities/notification.entity';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { NotificationCountDto } from './dto/notification-count.dto';

export interface PaginatedNotificationsResult {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CreateNotificationPayload {
  type: NotificationType;
  recipientId: string;
  message: string;
  senderId?: string;
  conversationId?: string;
  messageId?: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  /**
   * Creates a new notification document.
   */
  async create(payload: CreateNotificationPayload): Promise<Notification> {
    this.logger.log(
      `Creating notification type=${payload.type} for recipientId=${payload.recipientId}`,
    );
    const notification = new this.notificationModel(payload);
    return notification.save();
  }

  /**
   * Returns a paginated list of all notifications for a given user,
   * newest first.
   */
  async findAllForUser(
    userId: string,
    query: GetNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResult> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    this.logger.debug(
      `Fetching notifications for userId=${userId} page=${page} limit=${limit}`,
    );

    const [data, total] = await Promise.all([
      this.notificationModel
        .find({ recipientId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments({ recipientId: userId }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data as unknown as Notification[],
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Returns the number of unread notifications for a given user.
   */
  async countUnreadForUser(userId: string): Promise<NotificationCountDto> {
    this.logger.debug(`Counting unread notifications for userId=${userId}`);

    const count = await this.notificationModel.countDocuments({
      recipientId: userId,
      isRead: false,
    });

    return { count };
  }

  /**
   * Marks a single notification as read.
   */
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null> {
    return this.notificationModel
      .findOneAndUpdate(
        { _id: notificationId, recipientId: userId },
        { isRead: true },
        { new: true },
      )
      .lean()
      .exec() as unknown as Notification | null;
  }

  /**
   * Marks all notifications for a user as read.
   */
  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true },
    );
    return { modifiedCount: result.modifiedCount };
  }
}
