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
import { Property } from "./entities/property.entity";

@Controller("properties")
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) { }

 
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
}
