import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesService } from './properties.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

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

  describe('updateRentStructure', () => {
    const mockProperty = {
      id: 1,
      name: 'Park Place',
      type: 'property',
      position: 'top',
      grid_row: 0,
      grid_col: 7,
      price: 350,
      group_id: 8,
      color: '#0000FF',
      rent_site_only: 35,
      rent_one_house: 175,
      rent_two_houses: 500,
      rent_three_houses: 1100,
      rent_four_houses: 1300,
      rent_hotel: 1500,
      cost_of_house: 200,
      is_mortgaged: false,
      icon: '',
    } as Property;

    it('should update all rent fields when provided', async () => {
      mockRepository.findOne.mockResolvedValue(mockProperty);
      mockRepository.save.mockResolvedValue({
        ...mockProperty,
        rent_site_only: 50,
        rent_one_house: 200,
        rent_two_houses: 600,
        rent_three_houses: 1400,
        rent_four_houses: 1700,
        rent_hotel: 2000,
        cost_of_house: 250,
      });

      const updateDto = {
        rent_site_only: 50,
        rent_one_house: 200,
        rent_two_houses: 600,
        rent_three_houses: 1400,
        rent_four_houses: 1700,
        rent_hotel: 2000,
        cost_of_house: 250,
      };

      const result = await service.updateRentStructure(1, updateDto);

      expect(result).toBeDefined();
      expect(result.rent_site_only).toBe(50);
      expect(result.cost_of_house).toBe(250);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should support partial updates (only one field)', async () => {
      mockRepository.findOne.mockResolvedValue(mockProperty);
      mockRepository.save.mockResolvedValue({
        ...mockProperty,
        cost_of_house: 300,
      });

      const result = await service.updateRentStructure(1, {
        cost_of_house: 300,
      });

      expect(result.cost_of_house).toBe(300);
      // Other fields should remain unchanged
      expect(result.rent_site_only).toBe(mockProperty.rent_site_only);
    });

    it('should throw NotFoundException if property does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateRentStructure(999, { rent_site_only: 50 }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.updateRentStructure(999, { rent_site_only: 50 }),
      ).rejects.toThrow('Property with ID 999 not found');
    });

    it('should throw BadRequestException if no fields provided', async () => {
      mockRepository.findOne.mockResolvedValue(mockProperty);

      await expect(service.updateRentStructure(1, {})).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.updateRentStructure(1, {})).rejects.toThrow(
        'At least one rent field must be provided',
      );
    });

    it('should update only rent_hotel without affecting other fields', async () => {
      mockRepository.findOne.mockResolvedValue(mockProperty);
      mockRepository.save.mockResolvedValue({
        ...mockProperty,
        rent_hotel: 2500,
      });

      const result = await service.updateRentStructure(1, {
        rent_hotel: 2500,
      });

      expect(result.rent_hotel).toBe(2500);
      expect(result.rent_site_only).toBe(mockProperty.rent_site_only);
    });

    it('should accept decimal values', async () => {
      mockRepository.findOne.mockResolvedValue(mockProperty);
      mockRepository.save.mockResolvedValue({
        ...mockProperty,
        rent_site_only: 35.5,
      });

      const result = await service.updateRentStructure(1, {
        rent_site_only: 35.5,
      });

      expect(result.rent_site_only).toBe(35.5);
    });

    it('should update multiple fields at once', async () => {
      mockRepository.findOne.mockResolvedValue(mockProperty);
      mockRepository.save.mockResolvedValue({
        ...mockProperty,
        rent_site_only: 40,
        rent_one_house: 200,
        cost_of_house: 300,
      });

      const result = await service.updateRentStructure(1, {
        rent_site_only: 40,
        rent_one_house: 200,
        cost_of_house: 300,
      });

      expect(result.rent_site_only).toBe(40);
      expect(result.rent_one_house).toBe(200);
      expect(result.cost_of_house).toBe(300);
    });
  });

  describe('getPropertyRentStructure', () => {
    const mockProperty = {
      id: 1,
      name: 'Park Place',
      type: 'property',
      position: 'top',
      grid_row: 0,
      grid_col: 7,
      price: 350,
      group_id: 8,
      color: '#0000FF',
      rent_site_only: 35,
      rent_one_house: 175,
      rent_two_houses: 500,
      rent_three_houses: 1100,
      rent_four_houses: 1300,
      rent_hotel: 1500,
      cost_of_house: 200,
      is_mortgaged: false,
      icon: '',
    } as Property;

    it('should return property rent structure', async () => {
      mockRepository.findOne.mockResolvedValue(mockProperty);

      const result = await service.getPropertyRentStructure(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.name).toBe('Park Place');
      expect(result.rent_site_only).toBe(35);
      expect(result.rent_hotel).toBe(1500);
      expect(result.cost_of_house).toBe(200);
    });

    it('should throw NotFoundException if property not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getPropertyRentStructure(999)).rejects.toThrow(
        NotFoundException,
      );

      await expect(service.getPropertyRentStructure(999)).rejects.toThrow(
        'Property with ID 999 not found',
      );
    });
  });
});
