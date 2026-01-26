import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ChanceService } from './chance.service';
import { CreateChanceDto } from './dto/create-chance.dto';
import { Chance } from './entities/chance.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('chances')
export class ChanceController {
  constructor(private readonly chanceService: ChanceService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createChanceDto: CreateChanceDto): Promise<Chance> {
    return await this.chanceService.createChance(createChanceDto);
  }
}
