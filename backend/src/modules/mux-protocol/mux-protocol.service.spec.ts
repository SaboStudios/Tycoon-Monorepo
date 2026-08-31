import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MuxProtocolService } from './mux-protocol.service';
import { MuxAuditService } from './mux-audit.service';
import { MuxAuditAction, MuxPermission } from './mux-protocol.types';

describe('MuxProtocolService', () => {
  let service: MuxProtocolService;
  let auditService: MuxAuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MuxProtocolService, MuxAuditService],
    }).compile();

    service = module.get<MuxProtocolService>(MuxProtocolService);
    auditService = module.get<MuxAuditService>(MuxAuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('openChannel', () => {
    it('should create a channel with given permissions', () => {
      const channel = service.openChannel(1, [MuxPermission.READ]);

      expect(channel).toBeDefined();
      expect(channel.id).toBeDefined();
      expect(channel.userId).toBe(1);
      expect(channel.permissions).toEqual([MuxPermission.READ]);
    });

    it('should emit CHANNEL_OPENED audit event', () => {
      const emitSpy = jest.spyOn(auditService, 'emitChannelOpened');

      const channel = service.openChannel(1, [MuxPermission.READ], '127.0.0.1');

      expect(emitSpy).toHaveBeenCalledWith(
        channel.id,
        1,
        [MuxPermission.READ],
        '127.0.0.1',
      );
    });
  });

  describe('closeChannel', () => {
    it('should close an existing channel', () => {
      const channel = service.openChannel(1, [MuxPermission.READ]);

      service.closeChannel(channel.id, 1);

      expect(service.getChannel(channel.id)).toBeUndefined();
    });

    it('should emit CHANNEL_CLOSED audit event', () => {
      const emitSpy = jest.spyOn(auditService, 'emitChannelClosed');
      const channel = service.openChannel(1, [MuxPermission.READ]);

      service.closeChannel(channel.id, 1);

      expect(emitSpy).toHaveBeenCalledWith(channel.id, 1);
    });

    it('should throw ForbiddenException for wrong user', () => {
      const channel = service.openChannel(1, [MuxPermission.READ]);

      expect(() => service.closeChannel(channel.id, 999)).toThrow(
        ForbiddenException,
      );
    });

    it('should emit denied audit event for wrong user', () => {
      const emitSpy = jest.spyOn(auditService, 'emitPermissionCheck');
      const channel = service.openChannel(1, [MuxPermission.READ]);

      try {
        service.closeChannel(channel.id, 999);
      } catch {}

      expect(emitSpy).toHaveBeenCalledWith(
        channel.id,
        999,
        MuxPermission.READ,
        false,
      );
    });
  });

  describe('checkPermission', () => {
    it('should return true for granted permission', () => {
      const channel = service.openChannel(1, [
        MuxPermission.READ,
        MuxPermission.WRITE,
      ]);

      expect(service.checkPermission(channel.id, 1, MuxPermission.READ)).toBe(
        true,
      );
    });

    it('should return false for denied permission', () => {
      const channel = service.openChannel(1, [MuxPermission.READ]);

      expect(
        service.checkPermission(channel.id, 1, MuxPermission.ADMIN),
      ).toBe(false);
    });

    it('should return false for wrong user', () => {
      const channel = service.openChannel(1, [MuxPermission.READ]);

      expect(
        service.checkPermission(channel.id, 999, MuxPermission.READ),
      ).toBe(false);
    });

    it('should emit audit event for each check', () => {
      const channel = service.openChannel(1, [MuxPermission.READ]);
      const emitSpy = jest.spyOn(auditService, 'emitPermissionCheck');

      service.checkPermission(channel.id, 1, MuxPermission.READ, '10.0.0.1');

      expect(emitSpy).toHaveBeenCalledWith(
        channel.id,
        1,
        MuxPermission.READ,
        true,
        '10.0.0.1',
      );
    });

    it('should return false for non-existent channel', () => {
      expect(
        service.checkPermission('nonexistent', 1, MuxPermission.READ),
      ).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw when permission is granted', () => {
      const channel = service.openChannel(1, [MuxPermission.EXECUTE]);

      expect(() =>
        service.requirePermission(channel.id, 1, MuxPermission.EXECUTE),
      ).not.toThrow();
    });

    it('should throw ForbiddenException when permission is denied', () => {
      const channel = service.openChannel(1, [MuxPermission.READ]);

      expect(() =>
        service.requirePermission(channel.id, 1, MuxPermission.ADMIN),
      ).toThrow(ForbiddenException);
    });
  });

  describe('getActiveChannelCount', () => {
    it('should track active channels', () => {
      expect(service.getActiveChannelCount()).toBe(0);

      const ch1 = service.openChannel(1, [MuxPermission.READ]);
      const ch2 = service.openChannel(2, [MuxPermission.WRITE]);

      expect(service.getActiveChannelCount()).toBe(2);

      service.closeChannel(ch1.id, 1);

      expect(service.getActiveChannelCount()).toBe(1);
    });
  });
});
