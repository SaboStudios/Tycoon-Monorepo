// src/notifications/tests/notifications.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationType } from './entities/notification.entity';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import {
  PaginatedNotificationsResponseDto,
  PaginationMetaDto,
} from './dto/paginated-notifications-response.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockUser = { sub: 'user-uuid-1', email: 'user@example.com' };

const makePaginatedResponse = (
  overrides: Partial<PaginatedNotificationsResponseDto> = {},
): PaginatedNotificationsResponseDto => ({
  data: [
    {
      id: 'notif-uuid-1',
      userId: 'user-uuid-1',
      type: NotificationType.SYSTEM,
      title: 'Test',
      content: 'Test content',
      isRead: false,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    },
  ],
  meta: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
  ...overrides,
});

// ─── Mock Service ─────────────────────────────────────────────────────────────

const mockNotificationsService = {
  findAllForUser: jest.fn(),
  getUnreadCount: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    })
      // Bypass JwtAuthGuard in unit tests — integration tests cover auth
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  // ── GET /api/notifications ──────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('should call service.findAllForUser with user id and query params', async () => {
      const expected = makePaginatedResponse();
      mockNotificationsService.findAllForUser.mockResolvedValue(expected);

      const query: GetNotificationsQueryDto = { page: 1, limit: 20 };
      const result = await controller.getNotifications(mockUser as any, query);

      expect(mockNotificationsService.findAllForUser).toHaveBeenCalledWith(
        mockUser.sub,
        query,
      );
      expect(result).toBe(expected);
    });

    it('should pass isRead filter to service', async () => {
      mockNotificationsService.findAllForUser.mockResolvedValue(
        makePaginatedResponse({ data: [] }),
      );

      const query: GetNotificationsQueryDto = {
        page: 1,
        limit: 20,
        isRead: false,
      };
      await controller.getNotifications(mockUser as any, query);

      expect(mockNotificationsService.findAllForUser).toHaveBeenCalledWith(
        mockUser.sub,
        expect.objectContaining({ isRead: false }),
      );
    });

    it('should pass type filter to service', async () => {
      mockNotificationsService.findAllForUser.mockResolvedValue(
        makePaginatedResponse({ data: [] }),
      );

      const query: GetNotificationsQueryDto = {
        page: 1,
        limit: 20,
        type: NotificationType.MENTION,
      };
      await controller.getNotifications(mockUser as any, query);

      expect(mockNotificationsService.findAllForUser).toHaveBeenCalledWith(
        mockUser.sub,
        expect.objectContaining({ type: NotificationType.MENTION }),
      );
    });

    it('should return the paginated response from service', async () => {
      const expected = makePaginatedResponse();
      mockNotificationsService.findAllForUser.mockResolvedValue(expected);

      const result = await controller.getNotifications(mockUser as any, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  // ── GET /api/notifications/count ────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('should call service.getUnreadCount with user id', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(5);

      await controller.getUnreadCount(mockUser as any);

      expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith(
        mockUser.sub,
      );
    });

    it('should return { count: number } shape', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(mockUser as any);

      expect(result).toEqual({ count: 5 });
    });

    it('should return count of 0 when no unread notifications', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(0);

      const result = await controller.getUnreadCount(mockUser as any);

      expect(result).toEqual({ count: 0 });
    });

    it('should always wrap the number in a count object regardless of value', async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(99);

      const result = await controller.getUnreadCount(mockUser as any);

      expect(result).toHaveProperty('count');
      expect(typeof result.count).toBe('number');
      expect(result.count).toBe(99);
    });
  });
});
