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
