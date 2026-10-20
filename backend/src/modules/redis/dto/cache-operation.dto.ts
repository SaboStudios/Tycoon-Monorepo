import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Maximum TTL accepted by the API: 7 days in seconds. */
export const CACHE_TTL_MAX_SECONDS = 604_800;

/** Keys must be non-empty, ≤ 512 chars, and contain only safe characters. */
const KEY_PATTERN = /^[a-zA-Z0-9:_\-.*]+$/;

export class CacheSetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  @Matches(KEY_PATTERN, {
    message:
      'key may only contain letters, digits, colon, underscore, hyphen, dot, or asterisk',
  })
  key: string;

  /** Serialised value — callers are responsible for JSON.stringify if needed. */
  @IsNotEmpty()
  value: unknown;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CACHE_TTL_MAX_SECONDS)
  ttl?: number;
}

export class CacheGetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  @Matches(KEY_PATTERN, {
    message:
      'key may only contain letters, digits, colon, underscore, hyphen, dot, or asterisk',
  })
  key: string;
}

export class CacheDelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  @Matches(KEY_PATTERN, {
    message:
      'key may only contain letters, digits, colon, underscore, hyphen, dot, or asterisk',
  })
  key: string;
}

export class CacheScanPageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  @Matches(KEY_PATTERN, {
    message:
      'pattern may only contain letters, digits, colon, underscore, hyphen, dot, or asterisk',
  })
  pattern: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cursor?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  count?: number = 20;
}
