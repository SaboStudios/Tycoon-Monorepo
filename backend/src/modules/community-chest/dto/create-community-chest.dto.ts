import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsObject,
  Min,
  MaxLength,
} from 'class-validator';
import { ChanceType } from '../../chance/enums/chance-type.enum';

export class CreateCommunityChestDto {
  @IsString()
  @MaxLength(500)
  instruction: string;

  @IsEnum(ChanceType)
  type: ChanceType;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number | null;

  @IsOptional()
  @IsObject()
  extra?: Record<string, any> | null;
}
