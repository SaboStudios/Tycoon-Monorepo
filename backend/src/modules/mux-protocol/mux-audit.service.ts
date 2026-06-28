import { Injectable, Logger } from '@nestjs/common';
import {
  MuxAuditAction,
  MuxAuditEvent,
  MuxPermission,
} from './mux-protocol.types';

@Injectable()
export class MuxAuditService {
  private readonly logger = new Logger(MuxAuditService.name);
  private readonly auditLog: MuxAuditEvent[] = [];

  emit(event: MuxAuditEvent): void {
    this.auditLog.push(event);
    this.logger.log('Mux audit event', {
      action: event.action,
      channelId: event.channelId,
      userId: event.userId,
      permission: event.permission,
      granted: event.granted,
      timestamp: event.timestamp.toISOString(),
    });
  }

  emitPermissionCheck(
    channelId: string,
    userId: number,
    permission: MuxPermission,
    granted: boolean,
    ipAddress?: string,
  ): void {
    this.emit({
      action: granted
        ? MuxAuditAction.PERMISSION_GRANTED
        : MuxAuditAction.PERMISSION_DENIED,
      channelId,
      userId,
      permission,
      granted,
      timestamp: new Date(),
      ipAddress,
    });
  }

  emitChannelOpened(
    channelId: string,
    userId: number,
    permissions: MuxPermission[],
    ipAddress?: string,
  ): void {
    this.emit({
      action: MuxAuditAction.CHANNEL_OPENED,
      channelId,
      userId,
      timestamp: new Date(),
      ipAddress,
      metadata: { permissions },
    });
  }

  emitChannelClosed(channelId: string, userId: number): void {
    this.emit({
      action: MuxAuditAction.CHANNEL_CLOSED,
      channelId,
      userId,
      timestamp: new Date(),
    });
  }

  getAuditLog(): MuxAuditEvent[] {
    return [...this.auditLog];
  }

  getAuditLogForUser(userId: number): MuxAuditEvent[] {
    return this.auditLog.filter((e) => e.userId === userId);
  }

  getAuditLogForChannel(channelId: string): MuxAuditEvent[] {
    return this.auditLog.filter((e) => e.channelId === channelId);
  }
}
