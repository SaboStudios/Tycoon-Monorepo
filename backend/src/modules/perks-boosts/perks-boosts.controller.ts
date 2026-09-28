import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Delete,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { PerkService } from './services/perk.service';
import { BoostActivationService } from './services/boost-activation.service';
import { InventoryService } from './services/inventory.service';
import { Perk } from './entities/perk.entity';
import { ActiveBoost } from './entities/active-boost.entity';
import { PlayerPerk } from './entities/player-perk.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuditLog } from '../audit-trail/audit-log.decorator';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { AuditTrailInterceptor } from '../audit-trail/audit-trail.interceptor';

@Controller('perks')
@UseInterceptors(AuditTrailInterceptor)
export class PerksController {
  constructor(
    private readonly perkService: PerkService,
    private readonly boostActivationService: BoostActivationService,
    private readonly inventoryService: InventoryService,
  ) {}

  @Get()
  async findAll(): Promise<Perk[]> {
    return this.perkService.findAllActive();
  }

  @Get('inventory/:playerId')
  @UseGuards(JwtAuthGuard)
  async getInventory(
    @Param('playerId', ParseIntPipe) playerId: number,
  ): Promise<PlayerPerk[]> {
    return this.inventoryService.getPlayerInventory(playerId);
  }

  @Post('inventory/bulk')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @AuditLog(AuditAction.ADMIN_MUTATION)
  async addBulk(
    @Body()
    body: {
      playerId: number;
      perks: { perkId: number; quantity: number }[];
    },
  ): Promise<{ message: string }> {
    await this.inventoryService.addPerksToInventory(body.playerId, body.perks);
    return { message: 'Perks added successfully' };
  }

  @Post('equip')
  @UseGuards(JwtAuthGuard)
  @AuditLog(AuditAction.ADMIN_MUTATION)
  async equip(
    @Body() body: { playerId: number; perkId: number },
  ): Promise<PlayerPerk> {
    return this.inventoryService.equipPerk(body.playerId, body.perkId);
  }

  @Post('unequip')
  @UseGuards(JwtAuthGuard)
  @AuditLog(AuditAction.ADMIN_MUTATION)
  async unequip(
    @Body() body: { playerId: number; perkId: number },
  ): Promise<PlayerPerk> {
    return this.inventoryService.unequipPerk(body.playerId, body.perkId);
  }

  @Post('use')
  @UseGuards(JwtAuthGuard)
  @AuditLog(AuditAction.ADMIN_MUTATION)
  async usePerk(
    @Body() body: { playerId: number; gameId: number; perkId: number },
  ): Promise<ActiveBoost> {
    return this.boostActivationService.activatePerk(
      body.playerId,
      body.gameId,
      body.perkId,
    );
  }

  @Post('activate')
  @UseGuards(JwtAuthGuard)
  @AuditLog(AuditAction.ADMIN_MUTATION)
  async activate(
    @Body() body: { playerId: number; gameId: number; perkId: number },
  ): Promise<ActiveBoost> {
    return this.boostActivationService.activatePerk(
      body.playerId,
      body.gameId,
      body.perkId,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @AuditLog(AuditAction.ADMIN_MUTATION)
  async create(@Body() data: Partial<Perk>): Promise<Perk> {
    return this.perkService.create(data);
  }
}