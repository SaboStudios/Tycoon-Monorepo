import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AtLeastOneField } from '../validators/at-least-one-field.validator';

@AtLeastOneField(['wallet_address', 'email_address', 'telegram_username'])
export class UpdateWaitlistDto {
  @ApiPropertyOptional({
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    description: 'Stellar wallet address',
  })
  @IsOptional()
  @IsString()
  wallet_address?: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email address',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format.' })
  email_address?: string;

  @ApiPropertyOptional({
    example: '@username',
    description: 'Telegram username (must start with @)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^@[a-zA-Z0-9_]{5,32}$/, {
    message:
      'Telegram username must start with @ and be 5-32 characters (letters, numbers, underscores).',
  })
  telegram_username?: string;
}
