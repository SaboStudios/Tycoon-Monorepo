import { Test, TestingModule } from '@nestjs/testing';
import { MuxAuditService } from './mux-audit.service';
import { MuxAuditAction, MuxAuditEvent, MuxPermission } from './mux-protocol.types';

describe('MuxAuditService', () => {
  let service: MuxAuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MuxAuditService],
    }).compile();

    service = module.get<MuxAuditService>(MuxAuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emit', () => {
    it('should store audit events', () => {
      const event: MuxAuditEvent = {
        action: MuxAuditAction.PERMISSION_GRANTED,
        channelId: 'ch-1',
        userId: 1,
        permission: MuxPermission.READ,
        granted: true,
        timestamp: new Date(),
      };

      service.emit(event);

      expect(service.getAuditLog()).toHaveLength(1);
      expect(service.getAuditLog()[0]).toEqual(event);
    });

    it('should log the event', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.emit({
        action: MuxAuditAction.CHANNEL_OPENED,
        channelId: 'ch-1',
        userId: 1,
        timestamp: new Date(),
      });

      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('emitPermissionCheck', () => {
    it('should emit PERMISSION_GRANTED for granted=true', () => {
      service.emitPermissionCheck('ch-1', 1, MuxPermission.READ, true);

      const log = service.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].action).toBe(MuxAuditAction.PERMISSION_GRANTED);
      expect(log[0].granted).toBe(true);
    });

    it('should emit PERMISSION_DENIED for granted=false', () => {
      service.emitPermissionCheck('ch-1', 1, MuxPermission.ADMIN, false);

      const log = service.getAuditLog();
      expect(log[0].action).toBe(MuxAuditAction.PERMISSION_DENIED);
      expect(log[0].granted).toBe(false);
    });

    it('should include ipAddress when provided', () => {
      service.emitPermissionCheck(
        'ch-1',
        1,
        MuxPermission.WRITE,
        true,
        '192.168.1.1',
      );

      expect(service.getAuditLog()[0].ipAddress).toBe('192.168.1.1');
    });
  });

  describe('emitChannelOpened', () => {
    it('should emit CHANNEL_OPENED with permissions in metadata', () => {
      service.emitChannelOpened('ch-1', 1, [MuxPermission.READ, MuxPermission.WRITE]);

      const log = service.getAuditLog();
      expect(log[0].action).toBe(MuxAuditAction.CHANNEL_OPENED);
      expect(log[0].metadata).toEqual({
        permissions: [MuxPermission.READ, MuxPermission.WRITE],
      });
    });
  });

  describe('emitChannelClosed', () => {
    it('should emit CHANNEL_CLOSED event', () => {
      service.emitChannelClosed('ch-1', 1);

      const log = service.getAuditLog();
      expect(log[0].action).toBe(MuxAuditAction.CHANNEL_CLOSED);
      expect(log[0].channelId).toBe('ch-1');
    });
  });

  describe('getAuditLogForUser', () => {
    it('should filter events by userId', () => {
      service.emitPermissionCheck('ch-1', 1, MuxPermission.READ, true);
      service.emitPermissionCheck('ch-2', 2, MuxPermission.READ, true);
      service.emitPermissionCheck('ch-3', 1, MuxPermission.WRITE, false);

      const user1Log = service.getAuditLogForUser(1);
      expect(user1Log).toHaveLength(2);
      expect(user1Log.every((e) => e.userId === 1)).toBe(true);
    });
  });

  describe('getAuditLogForChannel', () => {
    it('should filter events by channelId', () => {
      service.emitPermissionCheck('ch-1', 1, MuxPermission.READ, true);
      service.emitPermissionCheck('ch-1', 1, MuxPermission.WRITE, false);
      service.emitPermissionCheck('ch-2', 2, MuxPermission.READ, true);

      const channelLog = service.getAuditLogForChannel('ch-1');
      expect(channelLog).toHaveLength(2);
      expect(channelLog.every((e) => e.channelId === 'ch-1')).toBe(true);
    });
  });

  describe('getAuditLog returns copies', () => {
    it('should return a defensive copy', () => {
      service.emitPermissionCheck('ch-1', 1, MuxPermission.READ, true);

      const log1 = service.getAuditLog();
      const log2 = service.getAuditLog();

      expect(log1).not.toBe(log2);
      expect(log1).toEqual(log2);
    });
  });
});
