// src/modules/notifications/dto/notification-count.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class NotificationCountDto {
  @ApiProperty({
    description: 'Number of unread notifications for the authenticated user',
    example: 7,
    minimum: 0,
  })
  count: number;
}
