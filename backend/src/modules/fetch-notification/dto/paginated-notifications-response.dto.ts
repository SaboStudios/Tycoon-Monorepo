import { ApiProperty } from '@nestjs/swagger';
import { NotificationResponseDto } from './notification-response.dto';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage: boolean;

  @ApiProperty({
    example: 'MjAyNC0wMS0wMVQwMDowMDowMC4wMDBafHV1aWQtMTIz',
    nullable: true,
    description:
      'Opaque cursor for the next page (keyset pagination). Pass back as ' +
      '`cursor` on the next request for stable ordering. Null on the last page.',
  })
  nextCursor: string | null;
}

export class PaginatedNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  data: NotificationResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
