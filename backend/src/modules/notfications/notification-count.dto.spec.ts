// src/modules/notifications/dto/notification-count.dto.spec.ts
import { NotificationCountDto } from './notification-count.dto';

describe('NotificationCountDto', () => {
  it('should be instantiatable', () => {
    const dto = new NotificationCountDto();
    expect(dto).toBeDefined();
  });

  it('should correctly hold a count value', () => {
    const dto = new NotificationCountDto();
    dto.count = 5;
    expect(dto.count).toBe(5);
  });

  it('should accept count of 0', () => {
    const dto = new NotificationCountDto();
    dto.count = 0;
    expect(dto.count).toBe(0);
  });

  it('should reflect the assigned count value', () => {
    const dto = Object.assign(new NotificationCountDto(), { count: 42 });
    expect(dto.count).toBe(42);
  });
});
