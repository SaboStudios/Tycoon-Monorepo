import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesService } from './properties.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { BadRequestException } from '@nestjs/common';

describe('PropertiesService', () => {
  let service: PropertiesService;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: getRepositoryToken(Property),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a property successfully when no duplicate exists', async () => {
      const createPropertyDto: CreatePropertyDto = {
        id: 1,
        type: 'property',
        name: 'Mediterranean Avenue',
        position: 'bottom',
        grid_row: 9,
        grid_col: 1,
        price: 60,
        group_id: 1,
        color: '#8B4513',
      };

      const createdProperty = {
        id: 1,
        type: 'property',
        name: 'Mediterranean Avenue',
        position: 'bottom',
        grid_row: 9,
        grid_col: 1,
        price: 60,
        group_id: 1,
        color: '#8B4513',
        rent_site_only: 0,
        rent_one_house: 0,
        rent_two_houses: 0,
        rent_three_houses: 0,
        rent_four_houses: 0,
        rent_hotel: 0,
        cost_of_house: 0,
        is_mortgaged: false,
        icon: '',
      } as Property;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(createdProperty);
      mockRepository.save.mockResolvedValue(createdProperty);

      const result = await service.create(createPropertyDto);

      expect(result).toEqual(createdProperty);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: createPropertyDto.id },
      });
      expect(mockRepository.create).toHaveBeenCalledWith(createPropertyDto);
      expect(mockRepository.save).toHaveBeenCalledWith(createdProperty);
    });

    it('should throw BadRequestException when property ID already exists', async () => {
      const createPropertyDto: CreatePropertyDto = {
        id: 1,
        type: 'property',
        name: 'Mediterranean Avenue',
        position: 'bottom',
        grid_row: 9,
        grid_col: 1,
        price: 60,
        group_id: 1,
        color: '#8B4513',
      };

      const existingProperty = {
        id: 1,
        type: 'property',
        name: 'Existing Property',
        position: 'bottom',
        grid_row: 8,
        grid_col: 2,
        price: 100,
        group_id: 1,
        color: '#8B4513',
        rent_site_only: 0,
        rent_one_house: 0,
        rent_two_houses: 0,
        rent_three_houses: 0,
        rent_four_houses: 0,
        rent_hotel: 0,
        cost_of_house: 0,
        is_mortgaged: false,
        icon: '',
      } as Property;

      mockRepository.findOne.mockResolvedValue(existingProperty);

      await expect(service.create(createPropertyDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createPropertyDto)).rejects.toThrow(
        'Property with ID 1 already exists',
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: createPropertyDto.id },
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should call repository save with correct data', async () => {
      const createPropertyDto: CreatePropertyDto = {
        id: 2,
        type: 'property',
        name: 'Baltic Avenue',
        position: 'bottom',
        grid_row: 9,
        grid_col: 3,
        price: 60,
        group_id: 1,
        color: '#8B4513',
        rent_site_only: 5,
        rent_hotel: 250,
      };

      const createdProperty = {
        id: 2,
        type: 'property',
        name: 'Baltic Avenue',
        position: 'bottom',
        grid_row: 9,
        grid_col: 3,
        price: 60,
        group_id: 1,
        color: '#8B4513',
        rent_site_only: 5,
        rent_one_house: 0,
        rent_two_houses: 0,
        rent_three_houses: 0,
        rent_four_houses: 0,
        rent_hotel: 250,
        cost_of_house: 0,
        is_mortgaged: false,
        icon: '',
      } as Property;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(createdProperty);
      mockRepository.save.mockResolvedValue(createdProperty);

      const result = await service.create(createPropertyDto);

      expect(result.rent_site_only).toBe(5);
      expect(result.rent_hotel).toBe(250);
      expect(mockRepository.save).toHaveBeenCalledWith(createdProperty);
    });

    it('should apply entity defaults for omitted optional fields', async () => {
      const createPropertyDto: CreatePropertyDto = {
        id: 3,
        type: 'property',
        name: 'Oriental Avenue',
        position: 'bottom',
        grid_row: 9,
        grid_col: 6,
        price: 100,
        group_id: 2,
        color: '#87CEEB',
      };

      const createdProperty = {
        id: 3,
        type: 'property',
        name: 'Oriental Avenue',
        position: 'bottom',
        grid_row: 9,
        grid_col: 6,
        price: 100,
        group_id: 2,
        color: '#87CEEB',
        rent_site_only: 0,
        rent_one_house: 0,
        rent_two_houses: 0,
        rent_three_houses: 0,
        rent_four_houses: 0,
        rent_hotel: 0,
        cost_of_house: 0,
        is_mortgaged: false,
        icon: '',
      } as Property;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(createdProperty);
      mockRepository.save.mockResolvedValue(createdProperty);

      const result = await service.create(createPropertyDto);

      expect(result.rent_site_only).toBe(0);
      expect(result.rent_one_house).toBe(0);
      expect(result.rent_hotel).toBe(0);
      expect(result.cost_of_house).toBe(0);
    });
  });
});
