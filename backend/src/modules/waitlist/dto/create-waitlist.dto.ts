import {
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWaitlistDto {
    @ApiPropertyOptional({ description: 'Wallet address of the user' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    wallet_address?: string;

    @ApiPropertyOptional({ description: 'Email address of the user' })
    @IsOptional()
    @IsEmail()
    @MaxLength(255)
    email_address?: string;

    @ApiPropertyOptional({ description: 'Telegram username of the user' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    telegram_username?: string;
}
