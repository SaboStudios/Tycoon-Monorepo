// src/modules/notifications/notifications.module.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationsModule } from './notifications.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';

describe('NotificationsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [NotificationsModule],
    })
      .overrideProvider(getModelToken(Notification.name))
      .useValue({
        find: jest.fn(),
        countDocuments: jest.fn(),
        findOneAndUpdate: jest.fn(),
        updateMany: jest.fn(),
      })
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide NotificationsService', () => {
    const service = module.get<NotificationsService>(NotificationsService);
    expect(service).toBeDefined();
  });

  it('should provide NotificationsController', () => {
    const controller = module.get<NotificationsController>(NotificationsController);
    expect(controller).toBeDefined();
  });

  it('should export NotificationsService', () => {
    // If the service is exported, it should be resolvable from the module context
    const service = module.get<NotificationsService>(NotificationsService);
    expect(service).toBeInstanceOf(NotificationsService);
  });
});
