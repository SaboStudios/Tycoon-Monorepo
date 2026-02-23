import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ToggleMortgageDto } from './dto/toggle-mortgage.dto';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { UpdateRentStructureDto } from './dto/update-rent-structure.dto';
import { RentStructureResponseDto } from './dto/rent-structure-response.dto';
import { Property } from './entities/property.entity';

@ApiTags('Properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createPropertyDto: CreatePropertyDto,
  ): Promise<Property> {
    return await this.propertiesService.create(createPropertyDto);
  }

  /**
   * Get all properties
   * GET /properties
   */
  @Get()
  async findAll(@Query() query: GetPropertiesDto): Promise<Property[]> {
    return await this.propertiesService.findAll(query);
  }

  /**
   * Toggle mortgage state of a property
   * PATCH /properties/:id/mortgage
   */
  @Patch(':id/mortgage')
  @HttpCode(HttpStatus.OK)
  async toggleMortgage(
    @Param('id', ParseIntPipe) id: number,
    @Body() toggleMortgageDto: ToggleMortgageDto,
  ): Promise<Property> {
    return await this.propertiesService.toggleMortgage(
      id,
      toggleMortgageDto.is_mortgaged,
    );
  }

  /**
   * Update property rent structure
   * PATCH /properties/:id/rent-structure
   */
  @Patch(':id/rent-structure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update property rent structure',
    description:
      'Update rent tiers and house costs for a property. Supports partial updates - only provided fields will be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Property ID',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateRentStructureDto })
  @ApiResponse({
    status: 200,
    description: 'Rent structure updated successfully',
    type: RentStructureResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or no fields provided',
    schema: {
      example: {
        statusCode: 400,
        message: ['rent_site_only cannot be negative'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Property with ID 999 not found',
        error: 'Not Found',
      },
    },
  })
  async updateRentStructure(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateRentStructureDto,
  ): Promise<RentStructureResponseDto> {
    return await this.propertiesService.updateRentStructure(id, updateDto);
  }

  /**
   * Get property rent structure
   * GET /properties/:id/rent-structure
   */
  @Get(':id/rent-structure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get property rent structure',
    description: 'Retrieve current rent tiers and house costs for a property',
  })
  @ApiParam({
    name: 'id',
    description: 'Property ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Rent structure retrieved successfully',
    type: RentStructureResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Property with ID 999 not found',
        error: 'Not Found',
      },
    },
  })
  async getRentStructure(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RentStructureResponseDto> {
    return await this.propertiesService.getPropertyRentStructure(id);
  }
}
