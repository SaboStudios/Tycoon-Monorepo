import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { UpdateRentStructureDto } from './dto/update-rent-structure.dto';
import { RentStructureResponseDto } from './dto/rent-structure-response.dto';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertiesRepository: Repository<Property>,
  ) {}

  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    // Check for duplicate ID
    const existingProperty = await this.propertiesRepository.findOne({
      where: { id: createPropertyDto.id },
    });

    if (existingProperty) {
      throw new BadRequestException(
        `Property with ID ${createPropertyDto.id} already exists`,
      );
    }

    // Create and save property (entity defaults apply automatically)
    const property = this.propertiesRepository.create(createPropertyDto);
    return await this.propertiesRepository.save(property);
  }

  /**
   * Get all properties with optional filtering
   * Sorted by ID (board position)
   */
  async findAll(query: GetPropertiesDto): Promise<Property[]> {
    const { type, group_id } = query;
    const qb = this.propertiesRepository.createQueryBuilder('property');

    if (type) {
      qb.andWhere('property.type = :type', { type });
    }

    if (group_id !== undefined) {
      qb.andWhere('property.group_id = :group_id', { group_id });
    }

    qb.orderBy('property.id', 'ASC');

    // Optimization: Select only column fields, avoiding any potential heavy relation data if added in future
    // For now, selecting all is efficient enough as Property entity is flat
    return await qb.getMany();
  }

  /**
   * Toggle the mortgage state of a property
   * @param id - Property ID
   * @param isMortgaged - New mortgage state
   * @returns Updated property
   */
  async toggleMortgage(id: number, isMortgaged: boolean): Promise<Property> {
    const property = await this.propertiesRepository.findOne({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    property.is_mortgaged = isMortgaged;
    return await this.propertiesRepository.save(property);
  }

  /**
   * Update rent structure for a property
   * Supports partial updates - only provided fields are updated
   */
  async updateRentStructure(
    propertyId: number,
    updateDto: UpdateRentStructureDto,
  ): Promise<RentStructureResponseDto> {
    // Find property
    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    // Validate at least one field is provided
    if (Object.keys(updateDto).length === 0) {
      throw new BadRequestException('At least one rent field must be provided');
    }

    // Update only provided fields (partial update support)
    if (updateDto.rent_site_only !== undefined) {
      property.rent_site_only = updateDto.rent_site_only;
    }
    if (updateDto.rent_one_house !== undefined) {
      property.rent_one_house = updateDto.rent_one_house;
    }
    if (updateDto.rent_two_houses !== undefined) {
      property.rent_two_houses = updateDto.rent_two_houses;
    }
    if (updateDto.rent_three_houses !== undefined) {
      property.rent_three_houses = updateDto.rent_three_houses;
    }
    if (updateDto.rent_four_houses !== undefined) {
      property.rent_four_houses = updateDto.rent_four_houses;
    }
    if (updateDto.rent_hotel !== undefined) {
      property.rent_hotel = updateDto.rent_hotel;
    }
    if (updateDto.cost_of_house !== undefined) {
      property.cost_of_house = updateDto.cost_of_house;
    }

    // Optional: Validate rent tier progression (warning, not error)
    this.validateRentProgression(property);

    // Save updated property
    const updatedProperty = await this.propertiesRepository.save(property);

    // Map to response DTO
    return {
      id: updatedProperty.id,
      name: updatedProperty.name,
      rent_site_only: updatedProperty.rent_site_only,
      rent_one_house: updatedProperty.rent_one_house,
      rent_two_houses: updatedProperty.rent_two_houses,
      rent_three_houses: updatedProperty.rent_three_houses,
      rent_four_houses: updatedProperty.rent_four_houses,
      rent_hotel: updatedProperty.rent_hotel,
      cost_of_house: updatedProperty.cost_of_house,
      updated_at: updatedProperty.updated_at,
    };
  }

  /**
   * Get property with rent structure details
   */
  async getPropertyRentStructure(
    propertyId: number,
  ): Promise<RentStructureResponseDto> {
    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    return {
      id: property.id,
      name: property.name,
      rent_site_only: property.rent_site_only,
      rent_one_house: property.rent_one_house,
      rent_two_houses: property.rent_two_houses,
      rent_three_houses: property.rent_three_houses,
      rent_four_houses: property.rent_four_houses,
      rent_hotel: property.rent_hotel,
      cost_of_house: property.cost_of_house,
      updated_at: property.updated_at,
    };
  }

  /**
   * Calculate rent for a property based on house count and mortgage status.
   *
   * Edge cases:
   * - If mortgaged: rent is 0 (property generates no income while mortgaged)
   * - If 0 houses: rent_site_only applies
   * - If 1-4 houses: corresponding rent tier applies
   * - If 5 houses (hotel): rent_hotel applies
   *
   * @param property - The property entity
   * @param houseCount - Number of houses on the property (0-5, where 5 = hotel)
   * @returns Rent amount due (0 if mortgaged)
   */
  calculateRent(property: Property, houseCount: number): number {
    if (property.is_mortgaged) {
      return 0;
    }

    switch (houseCount) {
      case 0:
        return property.rent_site_only;
      case 1:
        return property.rent_one_house;
      case 2:
        return property.rent_two_houses;
      case 3:
        return property.rent_three_houses;
      case 4:
        return property.rent_four_houses;
      case 5:
        return property.rent_hotel;
      default:
        return 0;
    }
  }

  /**
   * Validate rent values generally increase with more houses
   * Logs warning if not, but doesn't throw error (game design decision)
   */
  private validateRentProgression(property: Property): void {
    const rents = [
      property.rent_site_only,
      property.rent_one_house,
      property.rent_two_houses,
      property.rent_three_houses,
      property.rent_four_houses,
      property.rent_hotel,
    ];

    for (let i = 1; i < rents.length; i++) {
      if (rents[i] < rents[i - 1]) {
        console.warn(
          `[Property ${property.id}] Rent progression warning: ` +
            `Tier ${i} (${rents[i]}) is less than tier ${i - 1} (${rents[i - 1]})`,
        );
      }
    }
  }
}
