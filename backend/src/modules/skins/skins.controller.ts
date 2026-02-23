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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { SkinsService } from './skins.service';
import { CreateSkinDto } from './dto/create-skin.dto';
import { UpdateSkinDto } from './dto/update-skin.dto';
import { SkinCategory } from './enums/skin-category.enum';
import { SkinRarity } from './enums/skin-rarity.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming you have standard JWT guard

@ApiTags('skins')
@Controller('skins')
export class SkinsController {
  constructor(private readonly skinsService: SkinsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new skin (Admin)' })
  // @UseGuards(JwtAuthGuard, RolesGuard) // Add appropriate guards for admin
  create(@Body() createSkinDto: CreateSkinDto) {
    return this.skinsService.create(createSkinDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all skins' })
  @ApiQuery({ name: 'category', enum: SkinCategory, required: false })
  @ApiQuery({ name: 'rarity', enum: SkinRarity, required: false })
  findAll(
    @Query('category') category?: SkinCategory,
    @Query('rarity') rarity?: SkinRarity,
  ) {
    return this.skinsService.findAll({ category, rarity });
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get skins by category' })
  @ApiParam({ name: 'category', enum: SkinCategory })
  findByCategory(@Param('category') category: SkinCategory) {
    return this.skinsService.findByCategory(category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a skin by id' })
  findOne(@Param('id') id: string) {
    return this.skinsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a skin (Admin)' })
  update(@Param('id') id: string, @Body() updateSkinDto: UpdateSkinDto) {
    return this.skinsService.update(+id, updateSkinDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a skin (Admin)' })
  remove(@Param('id') id: string) {
    return this.skinsService.remove(+id);
  }

  @Post(':id/unlock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unlock a skin for the current user' })
  unlock(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    // req.user handles the authenticated user.
    return this.skinsService.unlockSkin(req.user.id, +id);
  }
}
