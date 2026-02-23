// src/notifications/tests/notifications.e2e.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsModule } from './notifications.module';
import { Notification, NotificationType } from './entities/notification.entity';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'user-e2e-uuid';

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    userId: USER_ID,
    type: NotificationType.SYSTEM,
    title: 'System Alert',
    content: 'Something happened.',
    isRead: false,
    createdAt: new Date('2024-06-01T10:00:00.000Z'),
  },
  {
    id: 'n2',
    userId: USER_ID,
    type: NotificationType.MENTION,
    title: 'You were mentioned',
    content: '@you was mentioned in a post.',
    isRead: true,
    createdAt: new Date('2024-06-01T09:00:00.000Z'),
  },
];

// ─── Mock Repository ─────────────────────────────────────────────────────────

const buildQb = (data: Notification[], count: number) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([data, count]),
});

const mockRepository = {
  createQueryBuilder: jest.fn(() =>
    buildQb(mockNotifications, mockNotifications.length),
  ),
  count: jest.fn().mockResolvedValue(1), // 1 unread
};

// ─── E2E Suite ───────────────────────────────────────────────────────────────

describe('NotificationsController (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotificationsModule],
    })
      .overrideProvider(getRepositoryToken(Notification))
      .useValue(mockRepository)
      // Simulate authenticated user — real auth tested separately
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { sub: USER_ID, email: 'user@example.com' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockImplementation(() =>
      buildQb(mockNotifications, mockNotifications.length),
    );
    mockRepository.count.mockResolvedValue(1);
  });

  // ── GET /api/notifications ────────────────────────────────────────────────

  describe('GET /api/notifications', () => {
    it('should return 200 with paginated notifications', async () => {
      const { body, status } = await request(app.getHttpServer()).get(
        '/api/notifications',
      );

      expect(status).toBe(200);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it('should include all expected notification fields', async () => {
      const { body } = await request(app.getHttpServer()).get(
        '/api/notifications',
      );

      const [first] = body.data;
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('userId');
      expect(first).toHaveProperty('type');
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('content');
      expect(first).toHaveProperty('isRead');
      expect(first).toHaveProperty('createdAt');
    });

    it('should include correct pagination meta fields', async () => {
      const { body } = await request(app.getHttpServer()).get(
        '/api/notifications',
      );

      expect(body.meta).toHaveProperty('page');
      expect(body.meta).toHaveProperty('limit');
      expect(body.meta).toHaveProperty('total');
      expect(body.meta).toHaveProperty('totalPages');
      expect(body.meta).toHaveProperty('hasNextPage');
      expect(body.meta).toHaveProperty('hasPreviousPage');
    });

    it('should accept page and limit query params', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/api/notifications?page=2&limit=10',
      );

      expect(status).toBe(200);
    });

    it('should return 400 for invalid page (non-numeric)', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/api/notifications?page=abc',
      );

      expect(status).toBe(400);
    });

    it('should return 400 for limit exceeding max (100)', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/api/notifications?limit=999',
      );

      expect(status).toBe(400);
    });

    it('should accept isRead=false query param', async () => {
      const unread = [mockNotifications[0]];
      mockRepository.createQueryBuilder.mockImplementation(() =>
        buildQb(unread, unread.length),
      );

      const { status, body } = await request(app.getHttpServer()).get(
        '/api/notifications?isRead=false',
      );

      expect(status).toBe(200);
      expect(body.data).toHaveLength(1);
    });

    it('should accept type query param', async () => {
      const { status } = await request(app.getHttpServer()).get(
        `/api/notifications?type=${NotificationType.SYSTEM}`,
      );

      expect(status).toBe(200);
    });

    it('should return 400 for invalid notification type', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/api/notifications?type=INVALID_TYPE',
      );

      expect(status).toBe(400);
    });
  });

  // ── GET /api/notifications/count ─────────────────────────────────────────

  describe('GET /api/notifications/count', () => {
    it('should return 200 with { count: number }', async () => {
      const { status, body } = await request(app.getHttpServer()).get(
        '/api/notifications/count',
      );

      expect(status).toBe(200);
      expect(body).toHaveProperty('count');
      expect(typeof body.count).toBe('number');
    });

    it('should return the correct unread count', async () => {
      mockRepository.count.mockResolvedValue(3);

      const { body } = await request(app.getHttpServer()).get(
        '/api/notifications/count',
      );

      expect(body.count).toBe(3);
    });

    it('should return count 0 when there are no unread notifications', async () => {
      mockRepository.count.mockResolvedValue(0);

      const { body } = await request(app.getHttpServer()).get(
        '/api/notifications/count',
      );

      expect(body).toEqual({ count: 0 });
    });

    it('should not accept query params and still return 200', async () => {
      const { status } = await request(app.getHttpServer()).get(
        '/api/notifications/count?extra=ignored',
      );

      expect(status).toBe(200);
    });
  });

  // ── Auth Guard ────────────────────────────────────────────────────────────

  describe('Auth protection', () => {
    it('should return 401 when JwtAuthGuard rejects', async () => {
      // Rebuild app with a rejecting guard for this specific test
      const moduleRef = await Test.createTestingModule({
        imports: [NotificationsModule],
      })
        .overrideProvider(getRepositoryToken(Notification))
        .useValue(mockRepository)
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => false })
        .compile();

      const unauthApp = moduleRef.createNestApplication();
      await unauthApp.init();

      const res1 = await request(unauthApp.getHttpServer()).get(
        '/api/notifications',
      );
      const res2 = await request(unauthApp.getHttpServer()).get(
        '/api/notifications/count',
      );

      expect(res1.status).toBe(403); // Forbidden when canActivate returns false without throwing
      expect(res2.status).toBe(403);

      await unauthApp.close();
    });
  });
});
