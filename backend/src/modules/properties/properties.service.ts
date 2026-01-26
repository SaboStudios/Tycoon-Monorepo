import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';

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
}
