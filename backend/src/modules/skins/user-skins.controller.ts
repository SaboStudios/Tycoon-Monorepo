import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserSkinsService } from './user-skins.service';
import { UnlockSkinDto } from './dto/unlock-skin.dto';

@ApiTags('user-skins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/skins')
export class UserSkinsController {
  constructor(private readonly userSkinsService: UserSkinsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all owned skins for the current user' })
  async getMySkins(@Request() req: any) {
    return this.userSkinsService.findAllByUserId(req.user.id);
  }

  @Post('unlock')
  @ApiOperation({ summary: 'Unlock a skin for the current user' })
  async unlockSkin(@Request() req: any, @Body() dto: UnlockSkinDto) {
    return this.userSkinsService.unlockSkin(req.user.id, dto.skinId);
  }
}
