import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRentStructureDto {
  @ApiProperty({
    description: 'Rent for site only (no houses)',
    example: 50,
    required: false,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'rent_site_only must be a valid number with max 2 decimal places',
    },
  )
  @Min(0, { message: 'rent_site_only cannot be negative' })
  @Max(1000000, { message: 'rent_site_only cannot exceed 1,000,000' })
  @Type(() => Number)
  rent_site_only?: number;

  @ApiProperty({
    description: 'Rent with one house',
    example: 150,
    required: false,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'rent_one_house must be a valid number with max 2 decimal places',
    },
  )
  @Min(0, { message: 'rent_one_house cannot be negative' })
  @Max(1000000, { message: 'rent_one_house cannot exceed 1,000,000' })
  @Type(() => Number)
  rent_one_house?: number;

  @ApiProperty({
    description: 'Rent with two houses',
    example: 450,
    required: false,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'rent_two_houses must be a valid number with max 2 decimal places',
    },
  )
  @Min(0, { message: 'rent_two_houses cannot be negative' })
  @Max(1000000, { message: 'rent_two_houses cannot exceed 1,000,000' })
  @Type(() => Number)
  rent_two_houses?: number;

  @ApiProperty({
    description: 'Rent with three houses',
    example: 1000,
    required: false,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'rent_three_houses must be a valid number with max 2 decimal places',
    },
  )
  @Min(0, { message: 'rent_three_houses cannot be negative' })
  @Max(1000000, { message: 'rent_three_houses cannot exceed 1,000,000' })
  @Type(() => Number)
  rent_three_houses?: number;

  @ApiProperty({
    description: 'Rent with four houses',
    example: 1200,
    required: false,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'rent_four_houses must be a valid number with max 2 decimal places',
    },
  )
  @Min(0, { message: 'rent_four_houses cannot be negative' })
  @Max(1000000, { message: 'rent_four_houses cannot exceed 1,000,000' })
  @Type(() => Number)
  rent_four_houses?: number;

  @ApiProperty({
    description: 'Rent with hotel',
    example: 1500,
    required: false,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'rent_hotel must be a valid number with max 2 decimal places' },
  )
  @Min(0, { message: 'rent_hotel cannot be negative' })
  @Max(1000000, { message: 'rent_hotel cannot exceed 1,000,000' })
  @Type(() => Number)
  rent_hotel?: number;

  @ApiProperty({
    description: 'Cost to build one house',
    example: 200,
    required: false,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'cost_of_house must be a valid number with max 2 decimal places',
    },
  )
  @Min(0, { message: 'cost_of_house cannot be negative' })
  @Max(1000000, { message: 'cost_of_house cannot exceed 1,000,000' })
  @Type(() => Number)
  cost_of_house?: number;
}
