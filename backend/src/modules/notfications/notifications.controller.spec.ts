// src/modules/notifications/notifications.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import {
  NotificationsService,
  PaginatedNotificationsResult,
} from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { NotificationType } from './entities/notification.entity';
import { Request } from 'express';

const MOCK_USER_ID = '507f1f77bcf86cd799439011';

/**
 * Creates a mock request object with the specified user ID.
 */
const mockRequest = (userId = MOCK_USER_ID): Request =>
  ({
    user: { id: userId },
  }) as unknown as Request;

const mockNotification = {
  _id: '665abc123def456789000001',
  type: NotificationType.NEW_MESSAGE,
  recipientId: MOCK_USER_ID,
  message: 'You have a new message',
  isRead: false,
  createdAt: new Date('2025-02-20T10:00:00Z'),
};

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const mockNotificationsService = {
    findAllForUser: jest.fn(),
    countUnreadForUser: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: MOCK_USER_ID };
          return true;
        },
      })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications', () => {
    const query: GetNotificationsQueryDto = { page: 1, limit: 20 };

    const paginatedResult: PaginatedNotificationsResult = {
      data: [mockNotification],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };

    it('should return paginated notifications', async () => {
      mockNotificationsService.findAllForUser.mockResolvedValue(
        paginatedResult,
      );

      const result = await controller.getNotifications(mockRequest(), query);

      expect(mockNotificationsService.findAllForUser).toHaveBeenCalledWith(
        MOCK_USER_ID,
        query,
      );
      expect(result).toEqual(paginatedResult);
    });

    it('should pass the correct userId from req.user.id', async () => {
      mockNotificationsService.findAllForUser.mockResolvedValue(
        paginatedResult,
      );

      await controller.getNotifications(mockRequest('custom-user-id'), query);

      expect(mockNotificationsService.findAllForUser).toHaveBeenCalledWith(
        'custom-user-id',
        query,
      );
    });

    it('should fall back to req.user.sub when id is not present', async () => {
      mockNotificationsService.findAllForUser.mockResolvedValue(
        paginatedResult,
      );
      const subRequest = {
        user: { sub: 'sub-user-id' },
      } as unknown as Request;

      await controller.getNotifications(subRequest, query);

      expect(mockNotificationsService.findAllForUser).toHaveBeenCalledWith(
        'sub-user-id',
        query,
      );
    });

    it('should return empty data array when user has no notifications', async () => {
      const emptyResult: PaginatedNotificationsResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
      mockNotificationsService.findAllForUser.mockResolvedValue(emptyResult);

      const result = await controller.getNotifications(mockRequest(), query);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should propagate service errors', async () => {
      mockNotificationsService.findAllForUser.mockRejectedValue(
        new Error('DB connection failed'),
      );

      await expect(
        controller.getNotifications(mockRequest(), query),
      ).rejects.toThrow('DB connection failed');
    });

    it('should pass custom pagination params to service', async () => {
      const customQuery: GetNotificationsQueryDto = { page: 3, limit: 10 };
      mockNotificationsService.findAllForUser.mockResolvedValue({
        ...paginatedResult,
        page: 3,
        limit: 10,
      });

      await controller.getNotifications(mockRequest(), customQuery);

      expect(mockNotificationsService.findAllForUser).toHaveBeenCalledWith(
        MOCK_USER_ID,
        customQuery,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return the unread count', async () => {
      mockNotificationsService.countUnreadForUser.mockResolvedValue({
        count: 5,
      });

      const result = await controller.getUnreadCount(mockRequest());

      expect(mockNotificationsService.countUnreadForUser).toHaveBeenCalledWith(
        MOCK_USER_ID,
      );
      expect(result).toEqual({ count: 5 });
    });

    it('should return count of 0 when there are no unread notifications', async () => {
      mockNotificationsService.countUnreadForUser.mockResolvedValue({
        count: 0,
      });

      const result = await controller.getUnreadCount(mockRequest());

      expect(result).toEqual({ count: 0 });
    });

    it('should fall back to req.user.sub when id is not present', async () => {
      mockNotificationsService.countUnreadForUser.mockResolvedValue({
        count: 3,
      });
      const subRequest = {
        user: { sub: 'sub-user-id' },
      } as unknown as Request;

      await controller.getUnreadCount(subRequest);

      expect(mockNotificationsService.countUnreadForUser).toHaveBeenCalledWith(
        'sub-user-id',
      );
    });

    it('should propagate service errors', async () => {
      mockNotificationsService.countUnreadForUser.mockRejectedValue(
        new Error('Redis timeout'),
      );

      await expect(controller.getUnreadCount(mockRequest())).rejects.toThrow(
        'Redis timeout',
      );
    });
  });
});
