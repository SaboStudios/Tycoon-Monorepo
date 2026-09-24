import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountResponseDto {
  @ApiProperty({ example: 5, description: 'Number of unread notifications' })
  count: number;
}
