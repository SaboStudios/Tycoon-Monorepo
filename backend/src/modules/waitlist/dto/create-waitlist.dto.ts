import {
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
    Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AtLeastOneField } from '../validators/at-least-one-field.validator';

@AtLeastOneField(['wallet_address', 'email_address', 'telegram_username'])
export class CreateWaitlistDto {
    @ApiPropertyOptional({
        description: 'Blockchain wallet address',
        example: '0xAbCd...1234',
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    wallet_address?: string;

    @ApiPropertyOptional({
        description: 'Email address',
        example: 'user@example.com',
    })
    @IsOptional()
    @IsEmail()
    @MaxLength(255)
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    email_address?: string;

    @ApiPropertyOptional({
        description: 'Telegram username (with or without leading @)',
        example: 'myusername',
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    // Telegram usernames: 5-32 chars, alphanumeric + underscores
    @Matches(/^@?[a-zA-Z0-9_]{1,100}$/, {
        message:
            'telegram_username may only contain letters, numbers, and underscores',
    })
    @Transform(({ value }: { value: unknown }) => {
        if (typeof value !== 'string') return value;
        return value.trim().replace(/^@/, '').toLowerCase();
    })
    telegram_username?: string;
}
