import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum CommunityChestSortBy {
  ID = 'id',
  INSTRUCTION = 'instruction',
  TYPE = 'type',
  AMOUNT = 'amount',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const COMMUNITY_CHEST_MAX_LIMIT = 100;

export class GetCommunityChestListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COMMUNITY_CHEST_MAX_LIMIT)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(CommunityChestSortBy)
  sortBy?: CommunityChestSortBy = CommunityChestSortBy.ID;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;

  @IsOptional()
  @IsString()
  type?: string;
}
