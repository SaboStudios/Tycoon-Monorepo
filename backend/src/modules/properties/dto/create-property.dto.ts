import {
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  IsHexColor,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export class CreatePropertyDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsOptional()
  group_id?: number;

  @IsString()
  @IsNotEmpty()
  position: string;

  @IsNumber()
  @Min(0)
  @Max(9)
  @IsNotEmpty()
  grid_row: number;

  @IsNumber()
  @Min(0)
  @Max(9)
  @IsNotEmpty()
  grid_col: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  rent_site_only?: number;

  @IsNumber()
  @IsOptional()
  rent_one_house?: number;

  @IsNumber()
  @IsOptional()
  rent_two_houses?: number;

  @IsNumber()
  @IsOptional()
  rent_three_houses?: number;

  @IsNumber()
  @IsOptional()
  rent_four_houses?: number;

  @IsNumber()
  @IsOptional()
  rent_hotel?: number;

  @IsNumber()
  @IsOptional()
  cost_of_house?: number;

  @IsBoolean()
  @IsOptional()
  is_mortgaged?: boolean;

  @IsHexColor()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;
}
