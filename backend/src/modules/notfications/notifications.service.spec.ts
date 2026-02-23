// src/modules/notifications/notifications.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

const MOCK_USER_ID = '507f1f77bcf86cd799439011';

const mockNotification = {
  _id: '665abc123def456789000001',
  type: NotificationType.NEW_MESSAGE,
  recipientId: MOCK_USER_ID,
  message: 'You have a new message',
  isRead: false,
  createdAt: new Date('2025-02-20T10:00:00Z'),
};

// Helper to build a chainable Mongoose query mock
function buildQueryMock(resolveValue: unknown) {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolveValue),
  };
  return chain;
}

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockNotificationModel = {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    save: jest.fn(),
    // Constructor mock
    prototype: { save: jest.fn() },
  };

  // Allow `new mockNotificationModel(...)` to return a saveable object
  function MockModel(data: unknown) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue({ ...data });
  }
  Object.assign(MockModel, mockNotificationModel);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(Notification.name),
          useValue: MockModel,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);

    // Attach static mocks to constructor
    (MockModel as any).find = jest.fn();
    (MockModel as any).countDocuments = jest.fn();
    (MockModel as any).findOneAndUpdate = jest.fn();
    (MockModel as any).updateMany = jest.fn();
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // findAllForUser
  // ---------------------------------------------------------------------------
  describe('findAllForUser', () => {
    const query: GetNotificationsQueryDto = { page: 1, limit: 20 };

    it('should return paginated notifications', async () => {
      const notifications = [
        mockNotification,
        { ...mockNotification, _id: '2' },
      ];
      (MockModel as any).find.mockReturnValue(buildQueryMock(notifications));
      (MockModel as any).countDocuments.mockResolvedValue(2);

      const result = await service.findAllForUser(MOCK_USER_ID, query);

      expect((MockModel as any).find).toHaveBeenCalledWith({
        recipientId: MOCK_USER_ID,
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should calculate totalPages correctly', async () => {
      (MockModel as any).find.mockReturnValue(buildQueryMock([]));
      (MockModel as any).countDocuments.mockResolvedValue(45);

      const result = await service.findAllForUser(MOCK_USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.totalPages).toBe(3); // ceil(45/20) = 3
    });

    it('should set hasNextPage=true when not on the last page', async () => {
      (MockModel as any).find.mockReturnValue(buildQueryMock([]));
      (MockModel as any).countDocuments.mockResolvedValue(50);

      const result = await service.findAllForUser(MOCK_USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(false);
    });

    it('should set hasPreviousPage=true when on page > 1', async () => {
      (MockModel as any).find.mockReturnValue(buildQueryMock([]));
      (MockModel as any).countDocuments.mockResolvedValue(50);

      const result = await service.findAllForUser(MOCK_USER_ID, {
        page: 2,
        limit: 20,
      });

      expect(result.hasPreviousPage).toBe(true);
    });

    it('should set hasNextPage=false on the last page', async () => {
      (MockModel as any).find.mockReturnValue(buildQueryMock([]));
      (MockModel as any).countDocuments.mockResolvedValue(20);

      const result = await service.findAllForUser(MOCK_USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.hasNextPage).toBe(false);
    });

    it('should call find with the correct skip value for page 3', async () => {
      const findMock = buildQueryMock([]);
      (MockModel as any).find.mockReturnValue(findMock);
      (MockModel as any).countDocuments.mockResolvedValue(100);

      await service.findAllForUser(MOCK_USER_ID, { page: 3, limit: 10 });

      expect(findMock.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(findMock.limit).toHaveBeenCalledWith(10);
    });

    it('should return empty data when user has no notifications', async () => {
      (MockModel as any).find.mockReturnValue(buildQueryMock([]));
      (MockModel as any).countDocuments.mockResolvedValue(0);

      const result = await service.findAllForUser(MOCK_USER_ID, query);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // countUnreadForUser
  // ---------------------------------------------------------------------------
  describe('countUnreadForUser', () => {
    it('should return the unread count', async () => {
      (MockModel as any).countDocuments.mockResolvedValue(7);

      const result = await service.countUnreadForUser(MOCK_USER_ID);

      expect((MockModel as any).countDocuments).toHaveBeenCalledWith({
        recipientId: MOCK_USER_ID,
        isRead: false,
      });
      expect(result).toEqual({ count: 7 });
    });

    it('should return 0 when there are no unread notifications', async () => {
      (MockModel as any).countDocuments.mockResolvedValue(0);

      const result = await service.countUnreadForUser(MOCK_USER_ID);

      expect(result).toEqual({ count: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // markAsRead
  // ---------------------------------------------------------------------------
  describe('markAsRead', () => {
    it('should update and return the notification', async () => {
      const updated = { ...mockNotification, isRead: true };
      const chain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updated),
      };
      (MockModel as any).findOneAndUpdate.mockReturnValue(chain);

      const result = await service.markAsRead(
        mockNotification._id,
        MOCK_USER_ID,
      );

      expect((MockModel as any).findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockNotification._id, recipientId: MOCK_USER_ID },
        { isRead: true },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('should return null when notification is not found', async () => {
      const chain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      (MockModel as any).findOneAndUpdate.mockReturnValue(chain);

      const result = await service.markAsRead('nonexistent-id', MOCK_USER_ID);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // markAllAsRead
  // ---------------------------------------------------------------------------
  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read and return modifiedCount', async () => {
      (MockModel as any).updateMany.mockResolvedValue({ modifiedCount: 5 });

      const result = await service.markAllAsRead(MOCK_USER_ID);

      expect((MockModel as any).updateMany).toHaveBeenCalledWith(
        { recipientId: MOCK_USER_ID, isRead: false },
        { isRead: true },
      );
      expect(result).toEqual({ modifiedCount: 5 });
    });

    it('should return modifiedCount of 0 when nothing was unread', async () => {
      (MockModel as any).updateMany.mockResolvedValue({ modifiedCount: 0 });

      const result = await service.markAllAsRead(MOCK_USER_ID);

      expect(result).toEqual({ modifiedCount: 0 });
    });
  });
});
