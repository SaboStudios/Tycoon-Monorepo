import { IsOptional, IsString, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsValidBlockchainAddress } from '../validators/game-validators';

export class EnhancedJoinGameDto {
  @ApiPropertyOptional({
    description: 'Player wallet/chain address',
    maxLength: 120,
    example: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45',
  })
  @IsOptional()
  @IsString({ message: 'address must be a string' })
  @IsValidBlockchainAddress({ message: 'Invalid blockchain address format' })
  @MaxLength(120, { message: 'address cannot exceed 120 characters' })
  @IsNotEmpty({ message: 'address cannot be empty if provided' })
  address?: string;
}
