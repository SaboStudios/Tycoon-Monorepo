import { Controller, Get, Post, Body, Param, UseGuards, Delete } from '@nestjs/common';
import { PerkService } from './services/perk.service';
import { BoostActivationService } from './services/boost-activation.service';
import { InventoryService } from './services/inventory.service';
import { Perk } from './entities/perk.entity';
import { ActiveBoost } from './entities/active-boost.entity';
import { PlayerPerk } from './entities/player-perk.entity';

@Controller('perks')
export class PerksController {
    constructor(
        private readonly perkService: PerkService,
        private readonly boostActivationService: BoostActivationService,
        private readonly inventoryService: InventoryService,
    ) { }

    @Get()
    async findAll(): Promise<Perk[]> {
        return this.perkService.findAllActive();
    }

    @Get('inventory/:playerId')
    async getInventory(@Param('playerId') playerId: number): Promise<PlayerPerk[]> {
        return this.inventoryService.getPlayerInventory(playerId);
    }

    @Post('inventory/bulk')
    async addBulk(
        @Body() body: { playerId: number; perks: { perkId: number; quantity: number }[] }
    ): Promise<{ message: string }> {
        await this.inventoryService.addPerksToInventory(body.playerId, body.perks);
        return { message: 'Perks added successfully' };
    }

    @Post('equip')
    async equip(
        @Body() body: { playerId: number; perkId: number }
    ): Promise<PlayerPerk> {
        return this.inventoryService.equipPerk(body.playerId, body.perkId);
    }

    @Post('unequip')
    async unequip(
        @Body() body: { playerId: number; perkId: number }
    ): Promise<PlayerPerk> {
        return this.inventoryService.unequipPerk(body.playerId, body.perkId);
    }

    @Post('use')
    async usePerk(
        @Body() body: { playerId: number; gameId: number; perkId: number }
    ): Promise<ActiveBoost> {
        return this.boostActivationService.activatePerk(body.playerId, body.gameId, body.perkId);
    }

    @Post('activate')
    async activate(
        @Body() body: { playerId: number; gameId: number; perkId: number }
    ): Promise<ActiveBoost> {
        return this.boostActivationService.activatePerk(body.playerId, body.gameId, body.perkId);
    }

    @Post()
    async create(@Body() data: Partial<Perk>): Promise<Perk> {
        return this.perkService.create(data);
    }
}
