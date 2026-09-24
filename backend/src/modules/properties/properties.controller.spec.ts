import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { BadRequestException } from '@nestjs/common';
import { Property } from './entities/property.entity';

describe('PropertiesController', () => {
  let controller: PropertiesController;

  const mockPropertiesService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [
        {
          provide: PropertiesService,
          useValue: mockPropertiesService,
        },
      ],
    }).compile();

    controller = module.get<PropertiesController>(PropertiesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a property successfully', async () => {
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

      const expectedProperty = {
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

      mockPropertiesService.create.mockResolvedValue(expectedProperty);

      const result = await controller.create(createPropertyDto);

      expect(result).toEqual(expectedProperty);
      expect(result.id).toBe(1);
      expect(result.name).toBe('Mediterranean Avenue');
      expect(result.grid_row).toBe(9);
      expect(result.grid_col).toBe(1);
      expect(mockPropertiesService.create).toHaveBeenCalledWith(
        createPropertyDto,
      );
    });

    it('should prevent duplicate property IDs', async () => {
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

      mockPropertiesService.create.mockRejectedValue(
        new BadRequestException('Property with ID 1 already exists'),
      );

      await expect(controller.create(createPropertyDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.create(createPropertyDto)).rejects.toThrow(
        'Property with ID 1 already exists',
      );
    });

    it('should apply default rent values when not provided', async () => {
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
      };

      const expectedProperty = {
        id: 2,
        type: 'property',
        name: 'Baltic Avenue',
        position: 'bottom',
        grid_row: 9,
        grid_col: 3,
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

      mockPropertiesService.create.mockResolvedValue(expectedProperty);

      const result = await controller.create(createPropertyDto);

      expect(result.rent_site_only).toBe(0);
      expect(result.rent_hotel).toBe(0);
      expect(mockPropertiesService.create).toHaveBeenCalledWith(
        createPropertyDto,
      );
    });

    it('should reject invalid grid position - exceeds max', async () => {
      const createPropertyDto: CreatePropertyDto = {
        id: 3,
        type: 'property',
        name: 'Test Property',
        position: 'bottom',
        grid_row: 15, // Exceeds max of 9
        grid_col: 5,
        price: 100,
        group_id: 1,
        color: '#8B4513',
      };

      mockPropertiesService.create.mockRejectedValue(
        new BadRequestException('Validation failed'),
      );

      await expect(controller.create(createPropertyDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid grid position - below min', async () => {
      const createPropertyDto: CreatePropertyDto = {
        id: 4,
        type: 'property',
        name: 'Test Property',
        position: 'bottom',
        grid_row: 5,
        grid_col: -1, // Below min of 0
        price: 100,
        group_id: 1,
        color: '#8B4513',
      };

      mockPropertiesService.create.mockRejectedValue(
        new BadRequestException('Validation failed'),
      );

      await expect(controller.create(createPropertyDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept valid grid positions', async () => {
      const createPropertyDto: CreatePropertyDto = {
        id: 5,
        type: 'property',
        name: 'Valid Property',
        position: 'bottom',
        grid_row: 5,
        grid_col: 5,
        price: 200,
        group_id: 2,
        color: '#FF5733',
      };

      const expectedProperty = {
        id: 5,
        type: 'property',
        name: 'Valid Property',
        position: 'bottom',
        grid_row: 5,
        grid_col: 5,
        price: 200,
        group_id: 2,
        color: '#FF5733',
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

      mockPropertiesService.create.mockResolvedValue(expectedProperty);

      const result = await controller.create(createPropertyDto);

      expect(result.grid_row).toBe(5);
      expect(result.grid_col).toBe(5);
      expect(mockPropertiesService.create).toHaveBeenCalledWith(
        createPropertyDto,
      );
    });
  });
});
