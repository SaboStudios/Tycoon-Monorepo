import { ApiProperty } from '@nestjs/swagger';

export class RentStructureResponseDto {
  @ApiProperty({ description: 'Property ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Property name', example: 'Park Place' })
  name: string;

  @ApiProperty({ description: 'Rent for site only', example: 35 })
  rent_site_only: number;

  @ApiProperty({ description: 'Rent with one house', example: 175 })
  rent_one_house: number;

  @ApiProperty({ description: 'Rent with two houses', example: 500 })
  rent_two_houses: number;

  @ApiProperty({ description: 'Rent with three houses', example: 1100 })
  rent_three_houses: number;

  @ApiProperty({ description: 'Rent with four houses', example: 1300 })
  rent_four_houses: number;

  @ApiProperty({ description: 'Rent with hotel', example: 1500 })
  rent_hotel: number;

  @ApiProperty({ description: 'Cost to build one house', example: 200 })
  cost_of_house: number;

  @ApiProperty({ description: 'Last updated timestamp' })
  updated_at: Date;
}
