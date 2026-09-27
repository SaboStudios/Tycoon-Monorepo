import { IsOptional, IsEnum, IsString } from 'class-validator';

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

export class GetCommunityChestListDto {
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
