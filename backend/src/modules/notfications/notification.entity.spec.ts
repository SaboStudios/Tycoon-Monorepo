// src/modules/notifications/entities/notification.entity.spec.ts
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationSchema,
  NotificationType,
} from './notification.entity';

describe('Notification Entity', () => {
  let model: Model<Notification>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getModelToken(Notification.name),
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    model = module.get<Model<Notification>>(getModelToken(Notification.name));
  });

  it('should be defined', () => {
    expect(model).toBeDefined();
  });

  describe('NotificationType enum', () => {
    it('should contain all expected message notification types', () => {
      expect(NotificationType.NEW_MESSAGE).toBe('NEW_MESSAGE');
      expect(NotificationType.MESSAGE_MENTION).toBe('MESSAGE_MENTION');
      expect(NotificationType.CONVERSATION_INVITE).toBe('CONVERSATION_INVITE');
    });

    it('should contain all expected transfer notification types', () => {
      expect(NotificationType.TRANSFER_RECEIVED).toBe('TRANSFER_RECEIVED');
      expect(NotificationType.TRANSFER_SENT).toBe('TRANSFER_SENT');
      expect(NotificationType.TRANSFER_COMPLETED).toBe('TRANSFER_COMPLETED');
      expect(NotificationType.TRANSFER_FAILED).toBe('TRANSFER_FAILED');
    });

    it('should contain all expected system notification types', () => {
      expect(NotificationType.SYSTEM_ALERT).toBe('SYSTEM_ALERT');
      expect(NotificationType.SYSTEM_UPDATE).toBe('SYSTEM_UPDATE');
      expect(NotificationType.SECURITY_ALERT).toBe('SECURITY_ALERT');
    });

    it('should contain all expected social notification types', () => {
      expect(NotificationType.FRIEND_REQUEST).toBe('FRIEND_REQUEST');
      expect(NotificationType.FRIEND_ACCEPTED).toBe('FRIEND_ACCEPTED');
      expect(NotificationType.USER_FOLLOWED).toBe('USER_FOLLOWED');
    });
  });

  describe('NotificationSchema', () => {
    it('should have a compound index on recipientId, isRead, createdAt', () => {
      const indexes = NotificationSchema.indexes();
      const compoundIndex = indexes.find(
        ([fields]) =>
          'recipientId' in fields &&
          'isRead' in fields &&
          'createdAt' in fields,
      );
      expect(compoundIndex).toBeDefined();
    });

    it('should require the type field', () => {
      const typePath = NotificationSchema.path('type');
      expect(typePath).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((typePath as any).isRequired).toBe(true);
    });

    it('should require the recipientId field', () => {
      const recipientPath = NotificationSchema.path('recipientId');
      expect(recipientPath).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((recipientPath as any).isRequired).toBe(true);
    });

    it('should require the message field', () => {
      const messagePath = NotificationSchema.path('message');
      expect(messagePath).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((messagePath as any).isRequired).toBe(true);
    });

    it('should default isRead to false', () => {
      const isReadPath = NotificationSchema.path('isRead');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((isReadPath as any).options.default).toBe(false);
    });

    it('should have timestamps enabled', () => {
      const options = NotificationSchema.options;
      expect(options.timestamps).toBe(true);
    });
  });
});
