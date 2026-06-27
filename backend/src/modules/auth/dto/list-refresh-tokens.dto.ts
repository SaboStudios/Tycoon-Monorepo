import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum TokenSortField {
  CREATED_AT = 'createdAt',
  LAST_USED_AT = 'lastUsedAt',
  EXPIRES_AT = 'expiresAt',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListRefreshTokensDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(TokenSortField)
  sortBy?: TokenSortField = TokenSortField.CREATED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isRevoked?: boolean;
}
