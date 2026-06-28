export enum MuxPermission {
  READ = 'READ',
  WRITE = 'WRITE',
  EXECUTE = 'EXECUTE',
  ADMIN = 'ADMIN',
}

export enum MuxAuditAction {
  PERMISSION_GRANTED = 'MUX_PERMISSION_GRANTED',
  PERMISSION_DENIED = 'MUX_PERMISSION_DENIED',
  CHANNEL_OPENED = 'MUX_CHANNEL_OPENED',
  CHANNEL_CLOSED = 'MUX_CHANNEL_CLOSED',
}

export interface MuxChannel {
  id: string;
  userId: number;
  permissions: MuxPermission[];
  openedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface MuxAuditEvent {
  action: MuxAuditAction;
  channelId: string;
  userId: number;
  permission?: MuxPermission;
  granted?: boolean;
  timestamp: Date;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}
