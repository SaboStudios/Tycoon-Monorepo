// src/notifications/tests/notifications.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

// ─── Factory Helpers ─────────────────────────────────────────────────────────

const makeNotification = (
  overrides: Partial<Notification> = {},
): Notification =>
  ({
    id: 'notif-uuid-1',
    userId: 'user-uuid-1',
    type: NotificationType.SYSTEM,
    title: 'Test Notification',
    content: 'This is a test notification.',
    isRead: false,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  }) as Notification;

// ─── Mock Repository ─────────────────────────────────────────────────────────

const createMockQueryBuilder = (
  results: Notification[],
  count: number,
): Partial<SelectQueryBuilder<Notification>> => {
  const qb: Partial<SelectQueryBuilder<Notification>> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([results, count]),
  };
  return qb;
};

const mockRepository = {
  createQueryBuilder: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  // ── findAllForUser ──────────────────────────────────────────────────────────

  describe('findAllForUser', () => {
    const userId = 'user-uuid-1';

    it('should return paginated notifications with correct meta', async () => {
      const notifications = [
        makeNotification(),
        makeNotification({ id: 'notif-uuid-2' }),
      ];
      const total = 42;
      const qb = createMockQueryBuilder(notifications, total);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const query: GetNotificationsQueryDto = { page: 1, limit: 20 };
      const result = await service.findAllForUser(userId, query);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('notif-uuid-1');
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 42,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it('should apply isRead filter when provided', async () => {
      const qb = createMockQueryBuilder([], 0);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAllForUser(userId, {
        page: 1,
        limit: 20,
        isRead: false,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'notification.isRead = :isRead',
        {
          isRead: false,
        },
      );
    });

    it('should NOT apply isRead filter when undefined', async () => {
      const qb = createMockQueryBuilder([], 0);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAllForUser(userId, { page: 1, limit: 20 });

      const andWhereCalls = (qb.andWhere as jest.Mock).mock.calls;
      const hasIsReadCall = andWhereCalls.some(([q]) => q.includes('isRead'));
      expect(hasIsReadCall).toBe(false);
    });

    it('should apply type filter when provided', async () => {
      const qb = createMockQueryBuilder([], 0);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAllForUser(userId, {
        page: 1,
        limit: 20,
        type: NotificationType.SYSTEM,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('notification.type = :type', {
        type: NotificationType.SYSTEM,
      });
    });

    it('should correctly calculate pagination offset on page 3', async () => {
      const qb = createMockQueryBuilder([], 0);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAllForUser(userId, { page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should set hasPreviousPage correctly on page 2', async () => {
      const qb = createMockQueryBuilder([], 50);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllForUser(userId, {
        page: 2,
        limit: 20,
      });

      expect(result.meta.hasPreviousPage).toBe(true);
      expect(result.meta.hasNextPage).toBe(true);
    });

    it('should set hasNextPage=false on the last page', async () => {
      const qb = createMockQueryBuilder([], 20);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllForUser(userId, {
        page: 1,
        limit: 20,
      });

      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should return empty data array when no notifications exist', async () => {
      const qb = createMockQueryBuilder([], 0);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllForUser(userId, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should map notification entity fields to response DTO correctly', async () => {
      const notification = makeNotification({
        type: NotificationType.TOKEN_RECEIVED,
        title: 'Token Received',
        isRead: true,
      });
      const qb = createMockQueryBuilder([notification], 1);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllForUser(userId, {
        page: 1,
        limit: 20,
      });
      const dto = result.data[0];

      expect(dto.id).toBe(notification.id);
      expect(dto.userId).toBe(notification.userId);
      expect(dto.type).toBe(NotificationType.TOKEN_RECEIVED);
      expect(dto.title).toBe('Token Received');
      expect(dto.isRead).toBe(true);
      expect(dto.createdAt).toBeInstanceOf(Date);
    });
  });

  // ── getUnreadCount ──────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    const userId = 'user-uuid-1';

    it('should return the correct unread count', async () => {
      mockRepository.count.mockResolvedValue(7);

      const result = await service.getUnreadCount(userId);

      expect(result).toBe(7);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { userId, isRead: false },
      });
    });

    it('should return 0 when there are no unread notifications', async () => {
      mockRepository.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(userId);

      expect(result).toBe(0);
    });

    it('should query with the correct userId', async () => {
      mockRepository.count.mockResolvedValue(3);

      await service.getUnreadCount('different-user-id');

      expect(mockRepository.count).toHaveBeenCalledWith({
        where: { userId: 'different-user-id', isRead: false },
      });
    });

    it('should return 0 when the notification source is unavailable', async () => {
      mockRepository.count.mockRejectedValue(new Error('connection refused'));

      const result = await service.getUnreadCount(userId);

      expect(result).toBe(0);
    });
  });

  // ── markAsRead ──────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    const userId = 'user-uuid-1';

    it('should mark and return the notification', async () => {
      const notification = makeNotification();
      const updated = { ...notification, isRead: true };
      mockRepository.findOne.mockResolvedValue(notification);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.markAsRead(notification.id, userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: notification.id, userId },
      });
      expect(result?.isRead).toBe(true);
    });

    it('should return null when notification is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.markAsRead('missing-id', userId);

      expect(result).toBeNull();
    });

    it('should return null when the notification source is unavailable', async () => {
      mockRepository.findOne.mockRejectedValue(new Error('connection refused'));

      const result = await service.markAsRead('notif-uuid-1', userId);

      expect(result).toBeNull();
    });
  });

  // ── markAllAsRead ───────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    const userId = 'user-uuid-1';

    it('should return modifiedCount from update', async () => {
      mockRepository.update.mockResolvedValue({ affected: 5 });

      const result = await service.markAllAsRead(userId);

      expect(mockRepository.update).toHaveBeenCalledWith(
        { userId, isRead: false },
        { isRead: true },
      );
      expect(result).toEqual({ modifiedCount: 5 });
    });

    it('should return modifiedCount of 0 when nothing was unread', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.markAllAsRead(userId);

      expect(result).toEqual({ modifiedCount: 0 });
    });

    it('should return modifiedCount 0 when the notification source is unavailable', async () => {
      mockRepository.update.mockRejectedValue(new Error('connection refused'));

      const result = await service.markAllAsRead(userId);

      expect(result).toEqual({ modifiedCount: 0 });
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should return null when the notification source is unavailable', async () => {
      mockRepository.create.mockReturnValue(makeNotification());
      mockRepository.save.mockRejectedValue(new Error('connection refused'));

      const result = await service.create({
        userId: 'user-uuid-1',
        type: NotificationType.SYSTEM,
        title: 'Test',
        content: 'Body',
      });

      expect(result).toBeNull();
    });
  });

  // ── findAllForUser (graceful degradation) ───────────────────────────────────

  describe('findAllForUser graceful degradation', () => {
    it('should return empty paginated result when the notification source is unavailable', async () => {
      mockRepository.createQueryBuilder.mockImplementation(() => {
        throw new Error('connection refused');
      });

      const result = await service.findAllForUser('user-uuid-1', {
        page: 2,
        limit: 10,
      });

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });
});
