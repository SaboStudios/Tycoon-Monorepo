import { Injectable, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MuxAuditService } from './mux-audit.service';
import { MuxChannel, MuxPermission } from './mux-protocol.types';

@Injectable()
export class MuxProtocolService {
  private readonly channels = new Map<string, MuxChannel>();

  constructor(private readonly auditService: MuxAuditService) {}

  openChannel(
    userId: number,
    permissions: MuxPermission[],
    ipAddress?: string,
  ): MuxChannel {
    const channel: MuxChannel = {
      id: uuidv4(),
      userId,
      permissions,
      openedAt: new Date(),
    };

    this.channels.set(channel.id, channel);
    this.auditService.emitChannelOpened(
      channel.id,
      userId,
      permissions,
      ipAddress,
    );

    return channel;
  }

  closeChannel(channelId: string, userId: number): void {
    const channel = this.channels.get(channelId);
    if (!channel || channel.userId !== userId) {
      this.auditService.emitPermissionCheck(
        channelId,
        userId,
        MuxPermission.READ,
        false,
      );
      throw new ForbiddenException('Channel not found or access denied');
    }

    this.channels.delete(channelId);
    this.auditService.emitChannelClosed(channelId, userId);
  }

  checkPermission(
    channelId: string,
    userId: number,
    permission: MuxPermission,
    ipAddress?: string,
  ): boolean {
    const channel = this.channels.get(channelId);

    if (!channel || channel.userId !== userId) {
      this.auditService.emitPermissionCheck(
        channelId,
        userId,
        permission,
        false,
        ipAddress,
      );
      return false;
    }

    const granted = channel.permissions.includes(permission);
    this.auditService.emitPermissionCheck(
      channelId,
      userId,
      permission,
      granted,
      ipAddress,
    );

    return granted;
  }

  requirePermission(
    channelId: string,
    userId: number,
    permission: MuxPermission,
    ipAddress?: string,
  ): void {
    if (!this.checkPermission(channelId, userId, permission, ipAddress)) {
      throw new ForbiddenException(
        `Permission ${permission} denied on channel ${channelId}`,
      );
    }
  }

  getChannel(channelId: string): MuxChannel | undefined {
    return this.channels.get(channelId);
  }

  getActiveChannelCount(): number {
    return this.channels.size;
  }
}
