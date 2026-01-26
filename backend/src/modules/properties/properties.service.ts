import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Property } from "./entities/property.entity";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { GetPropertiesDto } from "./dto/get-properties.dto";

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertiesRepository: Repository<Property>,
  ) { }

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
    const qb = this.propertiesRepository.createQueryBuilder("property");

    if (type) {
      qb.andWhere("property.type = :type", { type });
    }

    if (group_id !== undefined) {
      qb.andWhere("property.group_id = :group_id", { group_id });
    }

    qb.orderBy("property.id", "ASC");

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
}
