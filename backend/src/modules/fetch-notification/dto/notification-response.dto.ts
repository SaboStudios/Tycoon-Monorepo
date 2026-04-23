import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../entities/notification.entity';

export class NotificationResponseDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'uuid-456' })
  userId: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ example: 'New Message' })
  title: string;

  @ApiProperty({ example: 'You have received a new message.' })
  content: string;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;
}
