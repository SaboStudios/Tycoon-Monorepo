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
} from "@nestjs/common";
import { PropertiesService } from "./properties.service";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { ToggleMortgageDto } from "./dto/toggle-mortgage.dto";
import { GetPropertiesDto } from "./dto/get-properties.dto";
import { UpdateRentStructureDto } from "./dto/update-rent-structure.dto";
import { RentStructureResponseDto } from "./dto/rent-structure-response.dto";
import { Property } from "./entities/property.entity";

@Controller("properties")
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) { }

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
  @Patch(":id/mortgage")
  @HttpCode(HttpStatus.OK)
  async toggleMortgage(
    @Param("id", ParseIntPipe) id: number,
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
  @Patch(":id/rent-structure")
  @HttpCode(HttpStatus.OK)
  async updateRentStructure(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateRentStructureDto,
  ): Promise<RentStructureResponseDto> {
    return await this.propertiesService.updateRentStructure(id, updateDto);
  }

  /**
   * Get property rent structure
   * GET /properties/:id/rent-structure
   */
  @Get(":id/rent-structure")
  @HttpCode(HttpStatus.OK)
  async getRentStructure(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<RentStructureResponseDto> {
    return await this.propertiesService.getPropertyRentStructure(id);
  }
}

