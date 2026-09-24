import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class JoinGameDto {
  @ApiPropertyOptional({
    description: 'Player wallet/chain address',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'address cannot exceed 120 characters' })
  address?: string;
}
