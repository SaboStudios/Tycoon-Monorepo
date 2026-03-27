import {
  Controller,
  Get,
  Param,
  Query,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PerksService } from './perks.service';
import { FilterPerksDto } from './dto/filter-perks.dto';
import { Perk } from './entities/perk.entity';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { AdvancedCacheInterceptor } from '../../common/interceptors/advanced-cache.interceptor';
import { CacheOptions } from '../../common/decorators/cache-options.decorator';

@ApiTags('perks')
@Controller('perks')
@UseInterceptors(ResponseInterceptor)
export class PerksController {
  constructor(private readonly perksService: PerksService) {}

  @Get()
  @ApiOperation({ summary: 'List all active perks' })
  @ApiResponse({
    status: 200,
    description: 'List of active perks.',
    type: [Perk],
  })
  @UseInterceptors(AdvancedCacheInterceptor)
  @CacheOptions({ ttl: 600, keyPrefix: 'perks', useUserPrefix: false })
  findAll(@Query() filterDto?: FilterPerksDto): Promise<Perk[]> {
    return this.perksService.findAllPublic(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an active perk by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Perk found.', type: Perk })
  @ApiResponse({ status: 404, description: 'Perk not found.' })
  @UseInterceptors(AdvancedCacheInterceptor)
  @CacheOptions({ ttl: 600, keyPrefix: 'perks', useUserPrefix: false })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Perk> {
    return this.perksService.findOnePublic(id);
  }
}
