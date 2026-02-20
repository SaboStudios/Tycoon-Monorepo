// src/modules/notifications/notifications.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { NotificationType } from './entities/notification.entity';

const MOCK_USER_ID = '507f1f77bcf86cd799439011';

const mockRequest = (userId = MOCK_USER_ID) =>
  ({ user: { id: userId } }) as any;

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
  let service: jest.Mocked<NotificationsService>;

  const mockNotificationsService: jest.Mocked<Partial<NotificationsService>> = {
    findAllForUser: jest.fn(),
    countUnreadForUser: jest.fn(),
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
    service = module.get(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // GET /api/notifications
  // ---------------------------------------------------------------------------
  describe('getNotifications', () => {
    const query: GetNotificationsQueryDto = { page: 1, limit: 20 };

    const paginatedResult = {
      data: [mockNotification],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };

    it('should return paginated notifications', async () => {
      service.findAllForUser.mockResolvedValue(paginatedResult as any);

      const result = await controller.getNotifications(mockRequest(), query);

      expect(service.findAllForUser).toHaveBeenCalledWith(MOCK_USER_ID, query);
      expect(result).toEqual(paginatedResult);
    });

    it('should pass the correct userId from req.user.id', async () => {
      service.findAllForUser.mockResolvedValue(paginatedResult as any);

      await controller.getNotifications(mockRequest('custom-user-id'), query);

      expect(service.findAllForUser).toHaveBeenCalledWith('custom-user-id', query);
    });

    it('should fall back to req.user.sub when id is not present', async () => {
      service.findAllForUser.mockResolvedValue(paginatedResult as any);
      const subRequest = { user: { sub: 'sub-user-id' } } as any;

      await controller.getNotifications(subRequest, query);

      expect(service.findAllForUser).toHaveBeenCalledWith('sub-user-id', query);
    });

    it('should return empty data array when user has no notifications', async () => {
      const emptyResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
      service.findAllForUser.mockResolvedValue(emptyResult as any);

      const result = await controller.getNotifications(mockRequest(), query);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should propagate service errors', async () => {
      service.findAllForUser.mockRejectedValue(new Error('DB connection failed'));

      await expect(
        controller.getNotifications(mockRequest(), query),
      ).rejects.toThrow('DB connection failed');
    });

    it('should pass custom pagination params to service', async () => {
      const customQuery: GetNotificationsQueryDto = { page: 3, limit: 10 };
      service.findAllForUser.mockResolvedValue({ ...paginatedResult, page: 3, limit: 10 } as any);

      await controller.getNotifications(mockRequest(), customQuery);

      expect(service.findAllForUser).toHaveBeenCalledWith(MOCK_USER_ID, customQuery);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/notifications/count
  // ---------------------------------------------------------------------------
  describe('getUnreadCount', () => {
    it('should return the unread count', async () => {
      service.countUnreadForUser.mockResolvedValue({ count: 5 });

      const result = await controller.getUnreadCount(mockRequest());

      expect(service.countUnreadForUser).toHaveBeenCalledWith(MOCK_USER_ID);
      expect(result).toEqual({ count: 5 });
    });

    it('should return count of 0 when there are no unread notifications', async () => {
      service.countUnreadForUser.mockResolvedValue({ count: 0 });

      const result = await controller.getUnreadCount(mockRequest());

      expect(result).toEqual({ count: 0 });
    });

    it('should fall back to req.user.sub when id is not present', async () => {
      service.countUnreadForUser.mockResolvedValue({ count: 3 });
      const subRequest = { user: { sub: 'sub-user-id' } } as any;

      await controller.getUnreadCount(subRequest);

      expect(service.countUnreadForUser).toHaveBeenCalledWith('sub-user-id');
    });

    it('should propagate service errors', async () => {
      service.countUnreadForUser.mockRejectedValue(new Error('Redis timeout'));

      await expect(controller.getUnreadCount(mockRequest())).rejects.toThrow(
        'Redis timeout',
      );
    });
  });
});
