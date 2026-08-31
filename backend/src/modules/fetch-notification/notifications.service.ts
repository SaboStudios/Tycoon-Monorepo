// src/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import {
  PaginatedNotificationsResponseDto,
  PaginationMetaDto,
} from './dto/paginated-notifications-response.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from './dto/notification-cursor.util';

const EMPTY_PAGINATED = (
  page: number,
  limit: number,
): PaginatedNotificationsResponseDto => ({
  data: [],
  meta: {
    page,
    limit,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
    nextCursor: null,
  },
});

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  /**
   * Create a new notification.
   */
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    content: string;
  }): Promise<Notification | null> {
    return this.runSafe('create', null, async () => {
      const notification = this.notificationsRepository.create(data);
      return this.notificationsRepository.save(notification);
    });
  }

  /**
   * Fetch a paginated list of notifications for a specific user.
   * Supports optional filtering by isRead status and notification type.
   */
  async findAllForUser(
    userId: string,
    query: GetNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    const { page = 1, limit = 20, isRead, type, cursor } = query;

    return this.runSafe(
      'findAllForUser',
      EMPTY_PAGINATED(page, limit),
      async () => {
        const qb = this.notificationsRepository
          .createQueryBuilder('notification')
          .where('notification.userId = :userId', { userId })
          // Sorting on createdAt alone is not stable: rows inserted in the
          // same millisecond (common with bulk notifications) can be
          // returned in a different order on each fetch, causing
          // duplicate/skipped rows across pages. Tie-break on id.
          .orderBy('notification.createdAt', 'DESC')
          .addOrderBy('notification.id', 'DESC')
          .take(limit);

        if (isRead !== undefined) {
          qb.andWhere('notification.isRead = :isRead', { isRead });
        }

        if (type) {
          qb.andWhere('notification.type = :type', { type });
        }

        // Keyset (cursor) pagination avoids the row drift offset pagination
        // suffers from when notifications are inserted concurrently.
        const decodedCursor = cursor ? decodeNotificationCursor(cursor) : null;
        if (decodedCursor) {
          qb.andWhere(
            '(notification.createdAt < :cCreatedAt OR (notification.createdAt = :cCreatedAt AND notification.id < :cId))',
            {
              cCreatedAt: decodedCursor.createdAt,
              cId: decodedCursor.id,
            },
          );
        } else {
          qb.skip((page - 1) * limit);
        }

        const [notifications, total] = await qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        const lastRow = notifications[notifications.length - 1];

        const meta: PaginationMetaDto = {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          nextCursor:
            notifications.length === limit && lastRow
              ? encodeNotificationCursor(lastRow.createdAt, lastRow.id)
              : null,
        };

        return {
          data: notifications.map((n) => this.toResponseDto(n)),
          meta,
        };
      },
    );
  }

  /**
   * Returns the count of unread notifications for a user.
   * Optimized query — only counts rows, never loads entity data.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.runSafe('getUnreadCount', 0, () =>
      this.notificationsRepository.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    );
  }

  /**
   * Marks a single notification as read.
   */
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponseDto | null> {
    return this.runSafe('markAsRead', null, async () => {
      const notification = await this.notificationsRepository.findOne({
        where: { id: notificationId, userId },
      });
      if (!notification) {
        return null;
      }
      notification.isRead = true;
      const saved = await this.notificationsRepository.save(notification);
      return this.toResponseDto(saved);
    });
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    return this.runSafe('markAllAsRead', { modifiedCount: 0 }, async () => {
      const result = await this.notificationsRepository.update(
        { userId, isRead: false },
        { isRead: true },
      );
      return { modifiedCount: result.affected ?? 0 };
    });
  }

  private async runSafe<T>(
    operation: string,
    fallback: T,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger.warn(
        `Notification source unavailable during ${operation}`,
        err instanceof Error ? err.message : err,
      );
      return fallback;
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private toResponseDto(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }
}
