import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRentStructureDto {
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'rent_site_only must be a valid number with max 2 decimal places' })
    @Min(0, { message: 'rent_site_only cannot be negative' })
    @Max(1000000, { message: 'rent_site_only cannot exceed 1,000,000' })
    @Type(() => Number)
    rent_site_only?: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'rent_one_house must be a valid number with max 2 decimal places' })
    @Min(0, { message: 'rent_one_house cannot be negative' })
    @Max(1000000, { message: 'rent_one_house cannot exceed 1,000,000' })
    @Type(() => Number)
    rent_one_house?: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'rent_two_houses must be a valid number with max 2 decimal places' })
    @Min(0, { message: 'rent_two_houses cannot be negative' })
    @Max(1000000, { message: 'rent_two_houses cannot exceed 1,000,000' })
    @Type(() => Number)
    rent_two_houses?: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'rent_three_houses must be a valid number with max 2 decimal places' })
    @Min(0, { message: 'rent_three_houses cannot be negative' })
    @Max(1000000, { message: 'rent_three_houses cannot exceed 1,000,000' })
    @Type(() => Number)
    rent_three_houses?: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'rent_four_houses must be a valid number with max 2 decimal places' })
    @Min(0, { message: 'rent_four_houses cannot be negative' })
    @Max(1000000, { message: 'rent_four_houses cannot exceed 1,000,000' })
    @Type(() => Number)
    rent_four_houses?: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'rent_hotel must be a valid number with max 2 decimal places' })
    @Min(0, { message: 'rent_hotel cannot be negative' })
    @Max(1000000, { message: 'rent_hotel cannot exceed 1,000,000' })
    @Type(() => Number)
    rent_hotel?: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'cost_of_house must be a valid number with max 2 decimal places' })
    @Min(0, { message: 'cost_of_house cannot be negative' })
    @Max(1000000, { message: 'cost_of_house cannot exceed 1,000,000' })
    @Type(() => Number)
    cost_of_house?: number;
}
