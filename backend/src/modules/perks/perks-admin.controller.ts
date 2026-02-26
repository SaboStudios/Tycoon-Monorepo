import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PerksService } from './perks.service';
import { CreatePerkDto } from './dto/create-perk.dto';
import { UpdatePerkDto } from './dto/update-perk.dto';
import { CreateBoostDto } from './dto/create-boost.dto';
import { UpdateBoostDto } from './dto/update-boost.dto';
import { AdminPerksPaginationDto } from './dto/admin-perks-pagination.dto';
import { Perk } from './entities/perk.entity';
import { Boost } from './entities/boost.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { PaginatedResponse } from '../../common';

@ApiTags('admin-perks')
@ApiBearerAuth()
@Controller('admin/perks')
@UseGuards(JwtAuthGuard, AdminGuard)
@UseInterceptors(ResponseInterceptor)
export class PerksAdminController {
  constructor(private readonly perksService: PerksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new perk' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Perk created.', type: Perk })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin required.' })
  create(@Body() createPerkDto: CreatePerkDto): Promise<Perk> {
    return this.perksService.create(createPerkDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all perks with pagination and filters' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated perks.' })
  findAll(
    @Query() paginationDto: AdminPerksPaginationDto,
  ): Promise<PaginatedResponse<Perk>> {
    return this.perksService.findAllAdmin(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a perk by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Perk found.', type: Perk })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Perk not found.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Perk> {
    return this.perksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a perk' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Perk updated.', type: Perk })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Perk not found.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePerkDto: UpdatePerkDto,
  ): Promise<Perk> {
    return this.perksService.update(id, updatePerkDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a perk (hard delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Perk deleted.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Perk not found.' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.perksService.remove(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a perk' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Perk activated.', type: Perk })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Perk already active.' })
  activate(@Param('id', ParseIntPipe) id: number): Promise<Perk> {
    return this.perksService.activate(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a perk' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Perk deactivated.', type: Perk })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Perk already inactive.' })
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<Perk> {
    return this.perksService.deactivate(id);
  }

  @Get(':perkId/boosts')
  @ApiOperation({ summary: 'List boosts for a perk' })
  @ApiParam({ name: 'perkId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of boosts.', type: [Boost] })
  findBoosts(@Param('perkId', ParseIntPipe) perkId: number): Promise<Boost[]> {
    return this.perksService.findAllByPerkId(perkId);
  }

  @Post(':perkId/boosts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a boost for a perk' })
  @ApiParam({ name: 'perkId', type: Number })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Boost created.', type: Boost })
  createBoost(
    @Param('perkId', ParseIntPipe) perkId: number,
    @Body() createBoostDto: CreateBoostDto,
  ): Promise<Boost> {
    return this.perksService.createBoost(perkId, createBoostDto);
  }

  @Patch(':perkId/boosts/:boostId')
  @ApiOperation({ summary: 'Update a boost' })
  @ApiParam({ name: 'perkId', type: Number })
  @ApiParam({ name: 'boostId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Boost updated.', type: Boost })
  updateBoost(
    @Param('perkId', ParseIntPipe) perkId: number,
    @Param('boostId', ParseIntPipe) boostId: number,
    @Body() updateBoostDto: UpdateBoostDto,
  ): Promise<Boost> {
    return this.perksService.updateBoost(perkId, boostId, updateBoostDto);
  }

  @Delete(':perkId/boosts/:boostId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a boost' })
  @ApiParam({ name: 'perkId', type: Number })
  @ApiParam({ name: 'boostId', type: Number })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Boost deleted.' })
  removeBoost(
    @Param('perkId', ParseIntPipe) perkId: number,
    @Param('boostId', ParseIntPipe) boostId: number,
  ): Promise<void> {
    return this.perksService.removeBoost(perkId, boostId);
  }
}
